import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, chmodSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { ThreadIndex } from './types.js';

const BASE_DIR = join(homedir(), '.threadlinking');
const INDEX_PATH = join(BASE_DIR, 'thread_index.json');

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
