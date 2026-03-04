// Ignore pattern module for threadlinking
// Filters out build artifacts, dependencies, and other noise from pending files

import ignore, { type Ignore } from 'ignore';
import { readFileSync, existsSync, statSync } from 'fs';
import { relative, join } from 'path';
import { homedir } from 'os';
import { detectProjectRoot } from './utils.js';

const BUILTIN_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.DS_Store',
  '**/.gitkeep',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/.env',
  '**/.env.*',
  '**/.next/**',
  '**/coverage/**',
  '**/.cache/**',
];

const DEFAULT_IGNORE_CONTENT = `# Threadlinking ignore patterns (gitignore syntax)
# Files matching these patterns won't appear in pending list

# Dependencies
**/node_modules/**

# Build artifacts
**/dist/**
**/build/**
**/.next/**
**/.nuxt/**
**/coverage/**

# Lock files
**/package-lock.json
**/yarn.lock
**/pnpm-lock.yaml

# OS/editor files
**/.DS_Store
**/.gitkeep

# Environment files
**/.env
**/.env.*

# Cache
**/.cache/**
**/.venv/**
**/venv/**
**/__pycache__/**
`;

interface CacheEntry {
  ig: Ignore;
  mtime: number;
}

const GLOBAL_IGNORE_PATH = join(homedir(), '.threadlinkingignore');

let cache: {
  builtinIg: Ignore | null;
  global: CacheEntry | null;
  project: CacheEntry | null;
  projectRoot: string | null;
  combined: Ignore | null;
} = {
  builtinIg: null,
  global: null,
  project: null,
  projectRoot: null,
  combined: null,
};

function getFileMtime(filePath: string): number {
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function loadIgnoreFile(filePath: string): { patterns: string[]; mtime: number } | null {
  if (!existsSync(filePath)) {
    return null;
  }

  const mtime = getFileMtime(filePath);
  const content = readFileSync(filePath, 'utf-8');
  const patterns = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  return { patterns, mtime };
}

function buildCombinedIgnore(): Ignore {
  const projectRoot = detectProjectRoot();
  const globalMtime = getFileMtime(GLOBAL_IGNORE_PATH);
  const projectIgnorePath = projectRoot ? join(projectRoot, '.threadlinkingignore') : null;
  const projectMtime = projectIgnorePath ? getFileMtime(projectIgnorePath) : 0;

  // Check if cache is still valid
  const globalValid = cache.global?.mtime === globalMtime;
  const projectValid = cache.project?.mtime === projectMtime && cache.projectRoot === projectRoot;

  if (cache.combined && cache.builtinIg && globalValid && projectValid) {
    return cache.combined;
  }

  // Rebuild
  const ig = ignore();

  // Built-in patterns
  ig.add(BUILTIN_PATTERNS);

  // Global ignore file
  const globalData = loadIgnoreFile(GLOBAL_IGNORE_PATH);
  if (globalData) {
    ig.add(globalData.patterns);
    cache.global = { ig: ignore().add(globalData.patterns), mtime: globalData.mtime };
  } else {
    cache.global = { ig: ignore(), mtime: 0 };
  }

  // Project ignore file
  if (projectIgnorePath) {
    const projectData = loadIgnoreFile(projectIgnorePath);
    if (projectData) {
      ig.add(projectData.patterns);
      cache.project = { ig: ignore().add(projectData.patterns), mtime: projectData.mtime };
    } else {
      cache.project = { ig: ignore(), mtime: 0 };
    }
  }

  cache.builtinIg = ignore().add(BUILTIN_PATTERNS);
  cache.projectRoot = projectRoot;
  cache.combined = ig;

  return ig;
}

/**
 * Check if an absolute path should be ignored.
 * Converts absolute paths to relative (required by the `ignore` package).
 */
export function isIgnored(absolutePath: string): boolean {
  const ig = buildCombinedIgnore();

  // The `ignore` package works with relative paths
  // Try project root first, then home dir as fallback
  const projectRoot = detectProjectRoot();
  let relativePath: string;

  if (projectRoot && absolutePath.startsWith(projectRoot)) {
    relativePath = relative(projectRoot, absolutePath);
  } else {
    relativePath = relative(homedir(), absolutePath);
  }

  // Skip empty relative paths (the root itself)
  if (!relativePath || relativePath === '.') {
    return false;
  }

  try {
    return ig.ignores(relativePath);
  } catch {
    return false;
  }
}

/**
 * Clear the ignore cache. Useful for testing or after modifying ignore files.
 */
export function clearIgnoreCache(): void {
  cache = {
    builtinIg: null,
    global: null,
    project: null,
    projectRoot: null,
    combined: null,
  };
}

/**
 * Get the built-in default patterns.
 */
export function getBuiltinPatterns(): string[] {
  return [...BUILTIN_PATTERNS];
}

/**
 * Get the default content for a .threadlinkingignore file.
 * Single source of truth used by both `init` and tests.
 */
export function getDefaultIgnoreContent(): string {
  return DEFAULT_IGNORE_CONTENT;
}
