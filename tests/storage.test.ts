import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// The storage module computes BASE_DIR, INDEX_PATH, and PENDING_PATH at module load time
// using homedir(). To redirect storage to a temp directory, we must:
// 1. Set process.env.HOME before any import
// 2. Call vi.resetModules() between tests to clear the module cache
// 3. Use dynamic import() so re-evaluations pick up the new HOME

const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;
let tempHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'tl-storage-test-'));
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome; // Windows uses USERPROFILE for homedir()
  vi.resetModules();
});

afterEach(() => {
  process.env.HOME = originalHome;
  process.env.USERPROFILE = originalUserProfile;
  rmSync(tempHome, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function threadlinkingDir(): string {
  return join(tempHome, '.threadlinking');
}

function indexPath(): string {
  return join(threadlinkingDir(), 'thread_index.json');
}

function pendingPath(): string {
  return join(threadlinkingDir(), 'pending.json');
}

function ensureDir(): void {
  mkdirSync(threadlinkingDir(), { recursive: true });
}

function writeIndex(data: unknown): void {
  ensureDir();
  writeFileSync(indexPath(), JSON.stringify(data, null, 2), 'utf-8');
}

function writePending(data: unknown): void {
  ensureDir();
  writeFileSync(pendingPath(), JSON.stringify(data, null, 2), 'utf-8');
}

function makeThread(overrides: Partial<{
  summary: string;
  snippets: unknown[];
  linked_files: string[];
  date_created: string;
}> = {}) {
  return {
    summary: 'Test thread summary',
    snippets: [],
    linked_files: [],
    date_created: new Date().toISOString(),
    ...overrides,
  };
}

// A date string that is definitely older than 30 days
function expiredDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 31);
  return d.toISOString();
}

// A date string that is definitely within 30 days
function freshDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// loadIndex
// ---------------------------------------------------------------------------

describe('loadIndex', () => {
  it('returns empty object when index file does not exist', async () => {
    const { loadIndex } = await import('../src/core/storage.js');
    const result = loadIndex();
    expect(result).toEqual({});
  });

  it('returns parsed index when file contains valid JSON', async () => {
    const thread = makeThread({ summary: 'My feature thread' });
    writeIndex({ myproject: thread });

    const { loadIndex } = await import('../src/core/storage.js');
    const result = loadIndex();

    expect(result).toHaveProperty('myproject');
    expect(result['myproject'].summary).toBe('My feature thread');
  });

  it('returns object with multiple threads', async () => {
    const index = {
      alpha: makeThread({ summary: 'Alpha thread' }),
      beta: makeThread({ summary: 'Beta thread' }),
    };
    writeIndex(index);

    const { loadIndex } = await import('../src/core/storage.js');
    const result = loadIndex();

    expect(Object.keys(result)).toHaveLength(2);
    expect(result['alpha'].summary).toBe('Alpha thread');
    expect(result['beta'].summary).toBe('Beta thread');
  });

  it('backs up corrupted file and returns empty object on SyntaxError', async () => {
    ensureDir();
    writeFileSync(indexPath(), '{ this is not valid json!!!', 'utf-8');

    const { loadIndex } = await import('../src/core/storage.js');
    const result = loadIndex();

    // Should return empty index, not throw
    expect(result).toEqual({});

    // Original file should no longer exist (was renamed to .backup)
    expect(existsSync(indexPath())).toBe(false);

    // Backup file should exist with the original corrupted content
    const backupPath = indexPath() + '.backup';
    expect(existsSync(backupPath)).toBe(true);
    const backupContent = readFileSync(backupPath, 'utf-8');
    expect(backupContent).toBe('{ this is not valid json!!!');
  });

  it('does not throw for an array (arrays satisfy typeof === "object" guard)', async () => {
    // Arrays pass the typeof check in loadIndex because typeof [] === 'object'.
    // The guard only blocks primitives (string, number, boolean) and null.
    // This test documents the actual runtime behaviour so future refactors are
    // caught if the guard is tightened to also reject arrays.
    writeIndex(['not', 'an', 'object']);

    const { loadIndex } = await import('../src/core/storage.js');

    // Should return without throwing - the array is cast to ThreadIndex
    expect(() => loadIndex()).not.toThrow();
  });

  it('returns empty index when old file contains a JSON string (migration backs up)', async () => {
    ensureDir();
    writeFileSync(indexPath(), '"just a string"', 'utf-8');

    const { loadIndex } = await import('../src/core/storage.js');
    const result = loadIndex();

    // Migration detects non-object data, backs up, returns empty
    expect(result).toEqual({});
  });

  it('returns empty index when old file contains null (migration backs up)', async () => {
    ensureDir();
    writeFileSync(indexPath(), 'null', 'utf-8');

    const { loadIndex } = await import('../src/core/storage.js');
    const result = loadIndex();

    // Migration detects null data, backs up, returns empty
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// saveIndex
// ---------------------------------------------------------------------------

describe('saveIndex', () => {
  it('creates the .threadlinking directory when it does not exist', async () => {
    const { saveIndex } = await import('../src/core/storage.js');

    expect(existsSync(threadlinkingDir())).toBe(false);

    saveIndex({});

    expect(existsSync(threadlinkingDir())).toBe(true);
  });

  it('writes valid JSON that can be read back with loadIndex', async () => {
    const { saveIndex, loadIndex } = await import('../src/core/storage.js');
    const thread = makeThread({ summary: 'Roundtrip thread' });

    saveIndex({ roundtrip: thread });
    const result = loadIndex();

    expect(result).toHaveProperty('roundtrip');
    expect(result['roundtrip'].summary).toBe('Roundtrip thread');
  });

  it('writes JSON with pretty-print formatting (2-space indent)', async () => {
    const { saveIndex } = await import('../src/core/storage.js');

    saveIndex({ mythread: makeThread() });

    // Per-thread storage: check the thread file
    const threadFile = join(threadlinkingDir(), 'threads', 'mythread.json');
    const raw = readFileSync(threadFile, 'utf-8');
    // Pretty-printed JSON will contain newlines and indentation
    expect(raw).toContain('\n');
    expect(raw).toContain('  ');
  });

  it('sets 0600 permissions on thread files', async () => {
    if (process.platform === 'win32') return; // Windows doesn't support Unix permissions

    const { saveIndex } = await import('../src/core/storage.js');

    saveIndex({ mythread: makeThread() });

    // Per-thread storage: check the thread file
    const threadFile = join(threadlinkingDir(), 'threads', 'mythread.json');
    const stats = statSync(threadFile);
    // 0o100600 = regular file + owner read/write only
    const mode = stats.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('does not leave a temp file behind after atomic write', async () => {
    const { saveIndex } = await import('../src/core/storage.js');

    saveIndex({ mythread: makeThread() });

    // Per-thread storage: check the thread file
    const threadFile = join(threadlinkingDir(), 'threads', 'mythread.json');
    expect(existsSync(threadFile + '.tmp')).toBe(false);
  });

  it('overwrites existing index with new content', async () => {
    const { saveIndex, loadIndex } = await import('../src/core/storage.js');

    saveIndex({ first: makeThread({ summary: 'First' }) });
    saveIndex({ second: makeThread({ summary: 'Second' }) });

    const result = loadIndex();
    expect(result).not.toHaveProperty('first');
    expect(result).toHaveProperty('second');
    expect(result['second'].summary).toBe('Second');
  });
});

// ---------------------------------------------------------------------------
// updateIndex
// ---------------------------------------------------------------------------

describe('updateIndex', () => {
  it('applies the mutation function to the current index and returns updated result', async () => {
    const { updateIndex } = await import('../src/core/storage.js');
    const thread = makeThread({ summary: 'New thread from updateIndex' });

    const result = updateIndex((index) => {
      index['newthread'] = thread;
      return index;
    });

    expect(result).toHaveProperty('newthread');
    expect(result['newthread'].summary).toBe('New thread from updateIndex');
  });

  it('persists the mutated result to disk', async () => {
    const { updateIndex, loadIndex } = await import('../src/core/storage.js');
    const thread = makeThread({ summary: 'Persisted thread' });

    updateIndex((index) => {
      index['persisted'] = thread;
      return index;
    });

    const onDisk = loadIndex();
    expect(onDisk).toHaveProperty('persisted');
    expect(onDisk['persisted'].summary).toBe('Persisted thread');
  });

  it('receives the current index contents as the mutation input', async () => {
    const { saveIndex, updateIndex } = await import('../src/core/storage.js');
    const existingThread = makeThread({ summary: 'Pre-existing' });
    saveIndex({ existing: existingThread });

    let seenKeys: string[] = [];
    updateIndex((index) => {
      seenKeys = Object.keys(index);
      return index;
    });

    expect(seenKeys).toContain('existing');
  });

  it('does not save when the mutation function throws', async () => {
    const { saveIndex, updateIndex, loadIndex } = await import('../src/core/storage.js');
    const originalThread = makeThread({ summary: 'Original state' });
    saveIndex({ original: originalThread });

    expect(() => {
      updateIndex((_index) => {
        throw new Error('Intentional failure inside mutation');
      });
    }).toThrow('Intentional failure inside mutation');

    // Index on disk should be unchanged
    const onDisk = loadIndex();
    expect(onDisk).toHaveProperty('original');
    expect(onDisk['original'].summary).toBe('Original state');
  });

  it('handles two sequential updateIndex calls without corrupting state', async () => {
    const { updateIndex, loadIndex } = await import('../src/core/storage.js');

    updateIndex((index) => {
      index['first'] = makeThread({ summary: 'First write' });
      return index;
    });

    updateIndex((index) => {
      index['second'] = makeThread({ summary: 'Second write' });
      return index;
    });

    const onDisk = loadIndex();
    expect(onDisk).toHaveProperty('first');
    expect(onDisk).toHaveProperty('second');
    expect(onDisk['first'].summary).toBe('First write');
    expect(onDisk['second'].summary).toBe('Second write');
  });

  it('accumulates changes across multiple calls', async () => {
    const { updateIndex, loadIndex } = await import('../src/core/storage.js');

    for (let i = 0; i < 5; i++) {
      updateIndex((index) => {
        index[`thread${i}`] = makeThread({ summary: `Thread ${i}` });
        return index;
      });
    }

    const onDisk = loadIndex();
    expect(Object.keys(onDisk)).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(onDisk[`thread${i}`].summary).toBe(`Thread ${i}`);
    }
  });

  it('works when starting from an empty (non-existent) index file', async () => {
    const { updateIndex } = await import('../src/core/storage.js');

    expect(existsSync(indexPath())).toBe(false);

    const result = updateIndex((index) => {
      index['fresh'] = makeThread({ summary: 'Created from scratch' });
      return index;
    });

    expect(result).toHaveProperty('fresh');
  });

  it('can delete a thread via the mutation function', async () => {
    const { saveIndex, updateIndex, loadIndex } = await import('../src/core/storage.js');
    saveIndex({
      keep: makeThread({ summary: 'Keep me' }),
      remove: makeThread({ summary: 'Remove me' }),
    });

    updateIndex((index) => {
      delete index['remove'];
      return index;
    });

    const onDisk = loadIndex();
    expect(onDisk).toHaveProperty('keep');
    expect(onDisk).not.toHaveProperty('remove');
  });
});

// ---------------------------------------------------------------------------
// loadPending
// ---------------------------------------------------------------------------

describe('loadPending', () => {
  it('returns empty state when pending file does not exist', async () => {
    const { loadPending } = await import('../src/core/storage.js');

    const result = loadPending();

    expect(result).toEqual({ tracked: [] });
  });

  it('returns parsed state when file contains valid JSON', async () => {
    const state = {
      tracked: [
        {
          path: '/home/user/project/src/api.ts',
          first_seen: freshDate(),
          last_modified: freshDate(),
          count: 3,
        },
      ],
    };
    writePending(state);

    const { loadPending } = await import('../src/core/storage.js');
    const result = loadPending();

    expect(result.tracked).toHaveLength(1);
    expect(result.tracked[0].path).toBe('/home/user/project/src/api.ts');
    expect(result.tracked[0].count).toBe(3);
  });

  it('filters out files whose first_seen is older than 30 days', async () => {
    const state = {
      tracked: [
        {
          path: '/project/expired.ts',
          first_seen: expiredDate(),
          last_modified: expiredDate(),
          count: 1,
        },
        {
          path: '/project/fresh.ts',
          first_seen: freshDate(),
          last_modified: freshDate(),
          count: 2,
        },
      ],
    };
    writePending(state);

    const { loadPending } = await import('../src/core/storage.js');
    const result = loadPending();

    expect(result.tracked).toHaveLength(1);
    expect(result.tracked[0].path).toBe('/project/fresh.ts');
  });

  it('filters out all files when all entries are expired', async () => {
    const state = {
      tracked: [
        {
          path: '/project/old1.ts',
          first_seen: expiredDate(),
          last_modified: expiredDate(),
          count: 5,
        },
        {
          path: '/project/old2.ts',
          first_seen: expiredDate(),
          last_modified: expiredDate(),
          count: 7,
        },
      ],
    };
    writePending(state);

    const { loadPending } = await import('../src/core/storage.js');
    const result = loadPending();

    expect(result.tracked).toEqual([]);
  });

  it('keeps files seen exactly at the expiry boundary (29 days ago)', async () => {
    const twentyNineDaysAgo = new Date();
    twentyNineDaysAgo.setDate(twentyNineDaysAgo.getDate() - 29);

    const state = {
      tracked: [
        {
          path: '/project/borderline.ts',
          first_seen: twentyNineDaysAgo.toISOString(),
          last_modified: twentyNineDaysAgo.toISOString(),
          count: 1,
        },
      ],
    };
    writePending(state);

    const { loadPending } = await import('../src/core/storage.js');
    const result = loadPending();

    expect(result.tracked).toHaveLength(1);
    expect(result.tracked[0].path).toBe('/project/borderline.ts');
  });

  it('returns empty state when JSON is corrupted', async () => {
    ensureDir();
    writeFileSync(pendingPath(), '{ bad json ~~~', 'utf-8');

    const { loadPending } = await import('../src/core/storage.js');
    const result = loadPending();

    expect(result).toEqual({ tracked: [] });
  });

  it('returns empty state when tracked field is missing', async () => {
    writePending({ something_else: [] });

    const { loadPending } = await import('../src/core/storage.js');
    const result = loadPending();

    expect(result).toEqual({ tracked: [] });
  });

  it('returns empty state when tracked field is not an array', async () => {
    writePending({ tracked: 'not an array' });

    const { loadPending } = await import('../src/core/storage.js');
    const result = loadPending();

    expect(result).toEqual({ tracked: [] });
  });
});

// ---------------------------------------------------------------------------
// savePending
// ---------------------------------------------------------------------------

describe('savePending', () => {
  it('creates the .threadlinking directory when it does not exist', async () => {
    const { savePending } = await import('../src/core/storage.js');

    expect(existsSync(threadlinkingDir())).toBe(false);

    savePending({ tracked: [] });

    expect(existsSync(threadlinkingDir())).toBe(true);
  });

  it('writes valid JSON that can be read back with loadPending', async () => {
    const { savePending, loadPending } = await import('../src/core/storage.js');
    const state = {
      tracked: [
        {
          path: '/project/roundtrip.ts',
          first_seen: freshDate(),
          last_modified: freshDate(),
          count: 4,
        },
      ],
    };

    savePending(state);
    const result = loadPending();

    expect(result.tracked).toHaveLength(1);
    expect(result.tracked[0].path).toBe('/project/roundtrip.ts');
    expect(result.tracked[0].count).toBe(4);
  });

  it('sets 0600 permissions on the pending file', async () => {
    if (process.platform === 'win32') return; // Windows doesn't support Unix permissions

    const { savePending } = await import('../src/core/storage.js');

    savePending({ tracked: [] });

    const stats = statSync(pendingPath());
    const mode = stats.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('does not leave a temp file behind after atomic write', async () => {
    const { savePending } = await import('../src/core/storage.js');

    savePending({ tracked: [] });

    const tempPath = pendingPath() + '.tmp';
    expect(existsSync(tempPath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updatePending
// ---------------------------------------------------------------------------

describe('updatePending', () => {
  it('applies the mutation function to the current state and returns updated result', async () => {
    const { updatePending } = await import('../src/core/storage.js');
    const newFile = {
      path: '/project/newfile.ts',
      first_seen: freshDate(),
      last_modified: freshDate(),
      count: 1,
    };

    const result = updatePending((state) => {
      state.tracked.push(newFile);
      return state;
    });

    expect(result.tracked).toHaveLength(1);
    expect(result.tracked[0].path).toBe('/project/newfile.ts');
  });

  it('persists the mutated result to disk', async () => {
    const { updatePending, loadPending } = await import('../src/core/storage.js');
    const newFile = {
      path: '/project/persisted.ts',
      first_seen: freshDate(),
      last_modified: freshDate(),
      count: 2,
    };

    updatePending((state) => {
      state.tracked.push(newFile);
      return state;
    });

    const onDisk = loadPending();
    expect(onDisk.tracked).toHaveLength(1);
    expect(onDisk.tracked[0].path).toBe('/project/persisted.ts');
  });

  it('does not save when the mutation function throws', async () => {
    const { savePending, updatePending, loadPending } = await import('../src/core/storage.js');
    const initialState = {
      tracked: [
        {
          path: '/project/original.ts',
          first_seen: freshDate(),
          last_modified: freshDate(),
          count: 1,
        },
      ],
    };
    savePending(initialState);

    expect(() => {
      updatePending((_state) => {
        throw new Error('Pending mutation failure');
      });
    }).toThrow('Pending mutation failure');

    const onDisk = loadPending();
    expect(onDisk.tracked).toHaveLength(1);
    expect(onDisk.tracked[0].path).toBe('/project/original.ts');
  });

  it('handles two sequential updatePending calls without corrupting state', async () => {
    const { updatePending, loadPending } = await import('../src/core/storage.js');
    const file1 = {
      path: '/project/first.ts',
      first_seen: freshDate(),
      last_modified: freshDate(),
      count: 1,
    };
    const file2 = {
      path: '/project/second.ts',
      first_seen: freshDate(),
      last_modified: freshDate(),
      count: 1,
    };

    updatePending((state) => {
      state.tracked.push(file1);
      return state;
    });

    updatePending((state) => {
      state.tracked.push(file2);
      return state;
    });

    const onDisk = loadPending();
    expect(onDisk.tracked).toHaveLength(2);
    const paths = onDisk.tracked.map((f) => f.path);
    expect(paths).toContain('/project/first.ts');
    expect(paths).toContain('/project/second.ts');
  });

  it('can remove a file via the mutation function', async () => {
    const { savePending, updatePending, loadPending } = await import('../src/core/storage.js');
    savePending({
      tracked: [
        {
          path: '/project/keep.ts',
          first_seen: freshDate(),
          last_modified: freshDate(),
          count: 1,
        },
        {
          path: '/project/remove.ts',
          first_seen: freshDate(),
          last_modified: freshDate(),
          count: 1,
        },
      ],
    });

    updatePending((state) => {
      state.tracked = state.tracked.filter((f) => f.path !== '/project/remove.ts');
      return state;
    });

    const onDisk = loadPending();
    expect(onDisk.tracked).toHaveLength(1);
    expect(onDisk.tracked[0].path).toBe('/project/keep.ts');
  });

  it('works when starting from a non-existent pending file', async () => {
    const { updatePending } = await import('../src/core/storage.js');

    expect(existsSync(pendingPath())).toBe(false);

    const result = updatePending((state) => {
      state.tracked.push({
        path: '/project/brand-new.ts',
        first_seen: freshDate(),
        last_modified: freshDate(),
        count: 1,
      });
      return state;
    });

    expect(result.tracked).toHaveLength(1);
    expect(result.tracked[0].path).toBe('/project/brand-new.ts');
  });
});

// ---------------------------------------------------------------------------
// removeFromPending
// ---------------------------------------------------------------------------

describe('removeFromPending', () => {
  it('removes a tracked file by its path', async () => {
    const { savePending, removeFromPending, loadPending } = await import('../src/core/storage.js');
    savePending({
      tracked: [
        {
          path: '/project/keep.ts',
          first_seen: freshDate(),
          last_modified: freshDate(),
          count: 3,
        },
        {
          path: '/project/target.ts',
          first_seen: freshDate(),
          last_modified: freshDate(),
          count: 1,
        },
      ],
    });

    removeFromPending('/project/target.ts');

    const onDisk = loadPending();
    expect(onDisk.tracked).toHaveLength(1);
    expect(onDisk.tracked[0].path).toBe('/project/keep.ts');
  });

  it('does nothing when the path is not in the pending list', async () => {
    const { savePending, removeFromPending, loadPending } = await import('../src/core/storage.js');
    savePending({
      tracked: [
        {
          path: '/project/existing.ts',
          first_seen: freshDate(),
          last_modified: freshDate(),
          count: 2,
        },
      ],
    });

    // Should not throw
    expect(() => removeFromPending('/project/nonexistent.ts')).not.toThrow();

    const onDisk = loadPending();
    expect(onDisk.tracked).toHaveLength(1);
    expect(onDisk.tracked[0].path).toBe('/project/existing.ts');
  });

  it('handles removal when pending file does not exist at all', async () => {
    const { removeFromPending } = await import('../src/core/storage.js');

    expect(existsSync(pendingPath())).toBe(false);

    // Should not throw even when starting from scratch
    expect(() => removeFromPending('/project/ghost.ts')).not.toThrow();
  });

  it('removes only the target path when multiple files share similar names', async () => {
    const { savePending, removeFromPending, loadPending } = await import('../src/core/storage.js');
    savePending({
      tracked: [
        {
          path: '/project/api.ts',
          first_seen: freshDate(),
          last_modified: freshDate(),
          count: 1,
        },
        {
          path: '/project/api.test.ts',
          first_seen: freshDate(),
          last_modified: freshDate(),
          count: 1,
        },
        {
          path: '/project/api-utils.ts',
          first_seen: freshDate(),
          last_modified: freshDate(),
          count: 1,
        },
      ],
    });

    removeFromPending('/project/api.ts');

    const onDisk = loadPending();
    expect(onDisk.tracked).toHaveLength(2);
    const paths = onDisk.tracked.map((f) => f.path);
    expect(paths).not.toContain('/project/api.ts');
    expect(paths).toContain('/project/api.test.ts');
    expect(paths).toContain('/project/api-utils.ts');
  });

  it('leaves the pending file empty (tracked: []) when the only entry is removed', async () => {
    const { savePending, removeFromPending, loadPending } = await import('../src/core/storage.js');
    savePending({
      tracked: [
        {
          path: '/project/only.ts',
          first_seen: freshDate(),
          last_modified: freshDate(),
          count: 1,
        },
      ],
    });

    removeFromPending('/project/only.ts');

    const onDisk = loadPending();
    expect(onDisk.tracked).toEqual([]);
  });

  it('is idempotent: removing the same path twice does not throw', async () => {
    const { savePending, removeFromPending, loadPending } = await import('../src/core/storage.js');
    savePending({
      tracked: [
        {
          path: '/project/once.ts',
          first_seen: freshDate(),
          last_modified: freshDate(),
          count: 1,
        },
      ],
    });

    removeFromPending('/project/once.ts');
    expect(() => removeFromPending('/project/once.ts')).not.toThrow();

    const onDisk = loadPending();
    expect(onDisk.tracked).toEqual([]);
  });
});
