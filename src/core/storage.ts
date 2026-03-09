// Storage layer for threadlinking
// File-per-thread architecture (v3.0)
//
// Structure:
//   ~/.threadlinking/
//   ├── index.json          # Lightweight metadata: { version, threads: { id: { summary, dates } } }
//   ├── threads/
//   │   ├── myproject.json  # Full thread data
//   │   └── client.json
//   ├── pending.json        # Tracked but unlinked files
//   └── semantic-index/     # Vector embeddings
//
// Migration from v2 (monolithic thread_index.json) is automatic on first access.

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  renameSync,
  chmodSync,
  readdirSync,
  unlinkSync,
} from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { lockSync, unlockSync } from 'proper-lockfile';
import type { Thread, ThreadIndex } from './types.js';

// ===== Paths =====

const BASE_DIR = join(homedir(), '.threadlinking');
const OLD_INDEX_PATH = join(BASE_DIR, 'thread_index.json');
const META_INDEX_PATH = join(BASE_DIR, 'index.json');
const THREADS_DIR = join(BASE_DIR, 'threads');
const PENDING_PATH = join(BASE_DIR, 'pending.json');

const PENDING_EXPIRY_DAYS = 30;

// ===== Types =====

export interface ThreadMeta {
  summary: string;
  date_created: string;
  date_modified?: string;
  snippetCount?: number;
  fileCount?: number;
}

export interface MetaIndex {
  version: number;
  threads: Record<string, ThreadMeta>;
}

export interface PendingFile {
  path: string;
  first_seen: string;
  last_modified: string;
  count: number;
}

export interface PendingState {
  tracked: PendingFile[];
}

// ===== Lock Options =====

const LOCK_OPTIONS = {
  stale: 10000,
  update: 5000,
};

// ===== Internal Helpers =====

function ensureBaseDir(): void {
  if (!existsSync(BASE_DIR)) {
    mkdirSync(BASE_DIR, { recursive: true, mode: 0o700 });
  }
}

function ensureThreadsDir(): void {
  ensureBaseDir();
  if (!existsSync(THREADS_DIR)) {
    mkdirSync(THREADS_DIR, { recursive: true, mode: 0o700 });
  }
}

function ensureFileExists(filePath: string, defaultContent: string): void {
  ensureBaseDir();
  if (filePath.startsWith(THREADS_DIR)) {
    ensureThreadsDir();
  }
  if (!existsSync(filePath)) {
    writeFileSync(filePath, defaultContent, 'utf-8');
    chmodSync(filePath, 0o600);
  }
}

function atomicWrite(filePath: string, content: string): void {
  const dir = join(filePath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const tempPath = filePath + '.tmp';
  writeFileSync(tempPath, content, 'utf-8');
  renameSync(tempPath, filePath);
  chmodSync(filePath, 0o600);
}

function safeThreadPath(id: string): string {
  const threadPath = join(THREADS_DIR, `${id}.json`);
  // Defense-in-depth: ensure resolved path stays under THREADS_DIR
  if (!resolve(threadPath).startsWith(resolve(THREADS_DIR))) {
    throw new Error('Invalid thread ID: path traversal detected');
  }
  return threadPath;
}

function extractMeta(thread: Thread): ThreadMeta {
  return {
    summary: thread.summary,
    date_created: thread.date_created,
    date_modified: thread.date_modified,
    snippetCount: (thread.snippets || []).length,
    fileCount: (thread.linked_files || []).length,
  };
}

// ===== Migration =====

let _migrated = false;

/**
 * Ensure the storage has been migrated from monolithic to file-per-thread format.
 * Called automatically by all public functions. Safe to call multiple times.
 */
export function ensureMigrated(): void {
  if (_migrated) return;
  ensureBaseDir();

  // Check if old monolithic index exists and new meta index doesn't
  if (existsSync(OLD_INDEX_PATH) && !existsSync(META_INDEX_PATH)) {
    migrateToPerThread();
  }

  _migrated = true;
}

function migrateToPerThread(): void {
  try {
    const data = readFileSync(OLD_INDEX_PATH, 'utf-8');
    const oldIndex = JSON.parse(data) as ThreadIndex;

    if (typeof oldIndex !== 'object' || oldIndex === null) {
      // Invalid data - just backup and start fresh
      renameSync(OLD_INDEX_PATH, OLD_INDEX_PATH + '.backup');
      return;
    }

    ensureThreadsDir();

    // Split into individual thread files
    const meta: MetaIndex = { version: 2, threads: {} };

    for (const [id, thread] of Object.entries(oldIndex)) {
      atomicWrite(safeThreadPath(id), JSON.stringify(thread, null, 2));
      meta.threads[id] = extractMeta(thread);
    }

    // Write meta index
    atomicWrite(META_INDEX_PATH, JSON.stringify(meta, null, 2));

    // Backup old file
    renameSync(OLD_INDEX_PATH, OLD_INDEX_PATH + '.backup');
  } catch (error) {
    // If old file is already gone (another process migrated first), that's fine
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    // Handle corrupted JSON — backup and start fresh
    if (error instanceof SyntaxError) {
      try {
        renameSync(OLD_INDEX_PATH, OLD_INDEX_PATH + '.backup');
      } catch { /* file may already be gone */ }
      return;
    }
    throw error;
  }
}

/**
 * Reset the migration flag (for testing only).
 */
export function resetMigrationState(): void {
  _migrated = false;
}

// ===== Meta Index Operations =====

/**
 * Load the lightweight metadata index.
 * Fast: only reads thread IDs, summaries, and dates.
 */
export function loadMetaIndex(): MetaIndex {
  ensureMigrated();

  if (!existsSync(META_INDEX_PATH)) {
    return { version: 2, threads: {} };
  }

  try {
    const data = readFileSync(META_INDEX_PATH, 'utf-8');
    const parsed = JSON.parse(data) as MetaIndex;
    if (!parsed.threads || typeof parsed.threads !== 'object') {
      return { version: 2, threads: {} };
    }
    return parsed;
  } catch {
    return { version: 2, threads: {} };
  }
}

/**
 * Atomically update the meta index with locking.
 */
export function updateMetaIndex(fn: (meta: MetaIndex) => MetaIndex): MetaIndex {
  ensureMigrated();
  ensureFileExists(META_INDEX_PATH, JSON.stringify({ version: 2, threads: {} }));

  let release: (() => void) | null = null;
  try {
    release = lockSync(META_INDEX_PATH, LOCK_OPTIONS);
    const meta = loadMetaIndex();
    const updated = fn(meta);
    atomicWrite(META_INDEX_PATH, JSON.stringify(updated, null, 2));
    return updated;
  } finally {
    if (release) {
      try { unlockSync(META_INDEX_PATH); } catch { /* ignore */ }
    }
  }
}

// ===== Per-Thread Operations =====

/**
 * Load a single thread by ID. Returns null if not found.
 */
export function loadThread(id: string): Thread | null {
  ensureMigrated();

  const threadPath = safeThreadPath(id);
  if (!existsSync(threadPath)) return null;

  try {
    const data = readFileSync(threadPath, 'utf-8');
    return JSON.parse(data) as Thread;
  } catch {
    return null;
  }
}

/**
 * Save a single thread and update the meta index.
 */
export function saveThread(id: string, thread: Thread): void {
  ensureMigrated();
  ensureThreadsDir();

  // Write thread file atomically
  atomicWrite(safeThreadPath(id), JSON.stringify(thread, null, 2));

  // Update meta index (locked)
  updateMetaIndex((meta) => {
    meta.threads[id] = extractMeta(thread);
    return meta;
  });
}

/**
 * Atomically update a single thread with per-thread locking.
 * Much faster than updateIndex() for single-thread operations.
 *
 * Lock ordering: acquires per-thread lock, releases it, THEN acquires meta lock.
 * This prevents deadlock — no function ever holds two locks simultaneously.
 * Trade-off: brief window where thread file is updated but meta index is stale.
 * This is acceptable because meta is advisory (listing/display only) and
 * the thread file is always the source of truth.
 */
export function updateThread(id: string, fn: (thread: Thread) => Thread): Thread {
  ensureMigrated();
  ensureThreadsDir();

  const threadPath = safeThreadPath(id);
  ensureFileExists(threadPath, '{}');

  // Phase 1: Acquire thread lock, mutate, write, release
  let updated: Thread;
  let release: (() => void) | null = null;
  try {
    release = lockSync(threadPath, LOCK_OPTIONS);

    // Load fresh data
    const thread = loadThread(id);
    if (!thread || !thread.date_created) {
      throw new Error(`Thread '${id}' not found`);
    }

    // Apply mutation
    updated = fn(thread);

    // Save thread file atomically
    atomicWrite(threadPath, JSON.stringify(updated, null, 2));
  } finally {
    if (release) {
      try { unlockSync(threadPath); } catch { /* ignore */ }
    }
  }

  // Phase 2: Update meta index (outside thread lock — no nested locks)
  updateMetaIndex((meta) => {
    meta.threads[id] = extractMeta(updated);
    return meta;
  });

  return updated;
}

/**
 * Delete a thread file and remove from meta index.
 */
export function deleteThreadFile(id: string): void {
  ensureMigrated();

  const threadPath = safeThreadPath(id);
  if (existsSync(threadPath)) {
    unlinkSync(threadPath);
  }

  // Remove from meta index
  updateMetaIndex((meta) => {
    delete meta.threads[id];
    return meta;
  });
}

// ===== Full Index Operations (Backward Compat) =====

/**
 * Load all threads into a combined index.
 * Use loadThread(id) for single-thread access, or loadMetaIndex() for metadata only.
 */
export function loadAllThreads(): ThreadIndex {
  ensureMigrated();

  if (!existsSync(THREADS_DIR)) return {};

  const index: ThreadIndex = {};
  for (const file of readdirSync(THREADS_DIR)) {
    if (!file.endsWith('.json')) continue;
    const id = file.slice(0, -5);
    try {
      const data = readFileSync(join(THREADS_DIR, file), 'utf-8');
      index[id] = JSON.parse(data);
    } catch {
      // Skip corrupted thread files
    }
  }
  return index;
}

/**
 * Load all threads. Backward-compatible wrapper around loadAllThreads().
 */
export function loadIndex(): ThreadIndex {
  return loadAllThreads();
}

/**
 * Save a full index by writing individual thread files.
 * Backward-compatible wrapper. Prefer saveThread(id, thread) for single-thread writes.
 */
export function saveIndex(index: ThreadIndex): void {
  ensureMigrated();
  ensureThreadsDir();

  // Write each thread file
  for (const [id, thread] of Object.entries(index)) {
    atomicWrite(safeThreadPath(id), JSON.stringify(thread, null, 2));
  }

  // Remove thread files not in the new index
  if (existsSync(THREADS_DIR)) {
    for (const file of readdirSync(THREADS_DIR)) {
      if (!file.endsWith('.json')) continue;
      const id = file.slice(0, -5);
      if (!index[id]) {
        unlinkSync(join(THREADS_DIR, file));
      }
    }
  }

  // Rebuild meta index
  const meta: MetaIndex = { version: 2, threads: {} };
  for (const [id, thread] of Object.entries(index)) {
    meta.threads[id] = extractMeta(thread);
  }
  atomicWrite(META_INDEX_PATH, JSON.stringify(meta, null, 2));
}

/**
 * Atomically update the full index with global locking.
 * Backward-compatible. Prefer updateThread(id, fn) for single-thread updates.
 */
export function updateIndex(updateFn: (index: ThreadIndex) => ThreadIndex): ThreadIndex {
  ensureMigrated();
  ensureFileExists(META_INDEX_PATH, JSON.stringify({ version: 2, threads: {} }));

  let release: (() => void) | null = null;
  try {
    release = lockSync(META_INDEX_PATH, LOCK_OPTIONS);
    const index = loadAllThreads();
    const updated = updateFn(index);
    saveIndex(updated);
    return updated;
  } finally {
    if (release) {
      try { unlockSync(META_INDEX_PATH); } catch { /* ignore */ }
    }
  }
}

// ===== Path Getters =====

export function getIndexPath(): string {
  return META_INDEX_PATH;
}

export function getBaseDir(): string {
  return BASE_DIR;
}

export function getThreadsDir(): string {
  return THREADS_DIR;
}

// ===== Pending File Operations (Unchanged) =====

export function loadPending(): PendingState {
  if (!existsSync(PENDING_PATH)) {
    return { tracked: [] };
  }

  try {
    const data = readFileSync(PENDING_PATH, 'utf-8');
    const parsed = JSON.parse(data) as PendingState;

    if (!parsed.tracked || !Array.isArray(parsed.tracked)) {
      return { tracked: [] };
    }

    // Filter out expired files (older than 30 days)
    const now = new Date();
    const expiryMs = PENDING_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    parsed.tracked = parsed.tracked.filter((file) => {
      const firstSeen = new Date(file.first_seen);
      return now.getTime() - firstSeen.getTime() < expiryMs;
    });

    return parsed;
  } catch {
    return { tracked: [] };
  }
}

export function savePending(state: PendingState): void {
  ensureBaseDir();
  atomicWrite(PENDING_PATH, JSON.stringify(state, null, 2));
}

export function removeFromPending(filePath: string): void {
  const state = loadPending();
  state.tracked = state.tracked.filter((f) => f.path !== filePath);
  savePending(state);
}

export function updatePending(updateFn: (state: PendingState) => PendingState): PendingState {
  ensureFileExists(PENDING_PATH, '{"tracked":[]}');

  let release: (() => void) | null = null;
  try {
    release = lockSync(PENDING_PATH, LOCK_OPTIONS);
    const state = loadPending();
    const updated = updateFn(state);
    savePending(updated);
    return updated;
  } finally {
    if (release) {
      try { unlockSync(PENDING_PATH); } catch { /* ignore */ }
    }
  }
}
