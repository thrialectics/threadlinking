// Storage layer for threadlinking
// Handles reading/writing the thread index and pending files

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, chmodSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { ThreadIndex } from './types.js';

const BASE_DIR = join(homedir(), '.threadlinking');
const INDEX_PATH = join(BASE_DIR, 'thread_index.json');
const PENDING_PATH = join(BASE_DIR, 'pending.json');

const PENDING_EXPIRY_DAYS = 30;

export interface PendingFile {
  path: string;
  first_seen: string;
  last_modified: string;
  count: number;
}

export interface PendingState {
  tracked: PendingFile[];
}

export function loadIndex(): ThreadIndex {
  if (!existsSync(INDEX_PATH)) {
    return {};
  }

  try {
    const data = readFileSync(INDEX_PATH, 'utf-8');
    const parsed = JSON.parse(data);

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Thread index must be a JSON object');
    }

    return parsed as ThreadIndex;
  } catch (error) {
    if (error instanceof SyntaxError) {
      // Corrupted JSON - backup and start fresh
      const backupPath = INDEX_PATH + '.backup';
      console.warn(`Warning: Corrupted thread index. Backing up to ${backupPath}`);
      renameSync(INDEX_PATH, backupPath);
      return {};
    }
    throw error;
  }
}

export function saveIndex(index: ThreadIndex): void {
  // Ensure directory exists with secure permissions
  if (!existsSync(BASE_DIR)) {
    mkdirSync(BASE_DIR, { recursive: true, mode: 0o700 });
  }

  // Write to temp file first, then atomic rename
  const tempPath = INDEX_PATH + '.tmp';
  writeFileSync(tempPath, JSON.stringify(index, null, 2), 'utf-8');
  renameSync(tempPath, INDEX_PATH);

  // Set secure permissions
  chmodSync(INDEX_PATH, 0o600);
}

export function getIndexPath(): string {
  return INDEX_PATH;
}

export function getBaseDir(): string {
  return BASE_DIR;
}

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
    // Corrupted or invalid - start fresh
    return { tracked: [] };
  }
}

export function savePending(state: PendingState): void {
  // Ensure directory exists
  if (!existsSync(BASE_DIR)) {
    mkdirSync(BASE_DIR, { recursive: true, mode: 0o700 });
  }

  // Atomic write
  const tempPath = PENDING_PATH + '.tmp';
  writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
  renameSync(tempPath, PENDING_PATH);
  chmodSync(PENDING_PATH, 0o600);
}

export function removeFromPending(filePath: string): void {
  const state = loadPending();
  state.tracked = state.tracked.filter((f) => f.path !== filePath);
  savePending(state);
}
