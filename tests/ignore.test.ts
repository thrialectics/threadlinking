import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  isIgnored,
  clearIgnoreCache,
  getBuiltinPatterns,
  getDefaultIgnoreContent,
} from '../src/core/ignore.js';

const GLOBAL_IGNORE_PATH = join(homedir(), '.threadlinkingignore');

// Save and restore the global ignore file around tests
let originalContent: string | null = null;

beforeEach(() => {
  clearIgnoreCache();
  if (existsSync(GLOBAL_IGNORE_PATH)) {
    originalContent = readFileSync(GLOBAL_IGNORE_PATH, 'utf-8');
  } else {
    originalContent = null;
  }
});

afterEach(() => {
  clearIgnoreCache();
  if (originalContent !== null) {
    writeFileSync(GLOBAL_IGNORE_PATH, originalContent, 'utf-8');
  } else if (existsSync(GLOBAL_IGNORE_PATH)) {
    unlinkSync(GLOBAL_IGNORE_PATH);
  }
});

describe('getBuiltinPatterns', () => {
  it('should return an array of patterns', () => {
    const patterns = getBuiltinPatterns();
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('should include common noise patterns', () => {
    const patterns = getBuiltinPatterns();
    expect(patterns).toContain('**/node_modules/**');
    expect(patterns).toContain('**/.git/**');
    expect(patterns).toContain('**/dist/**');
    expect(patterns).toContain('**/.DS_Store');
    expect(patterns).toContain('**/package-lock.json');
  });

  it('should return a copy (not mutable)', () => {
    const patterns1 = getBuiltinPatterns();
    patterns1.push('extra');
    const patterns2 = getBuiltinPatterns();
    expect(patterns2).not.toContain('extra');
  });
});

describe('getDefaultIgnoreContent', () => {
  it('should return a non-empty string', () => {
    const content = getDefaultIgnoreContent();
    expect(content.length).toBeGreaterThan(0);
  });

  it('should contain common patterns', () => {
    const content = getDefaultIgnoreContent();
    expect(content).toContain('node_modules');
    expect(content).toContain('dist');
    expect(content).toContain('.DS_Store');
    expect(content).toContain('package-lock.json');
  });

  it('should have comment lines starting with #', () => {
    const content = getDefaultIgnoreContent();
    const lines = content.split('\n');
    const comments = lines.filter((l) => l.startsWith('#'));
    expect(comments.length).toBeGreaterThan(0);
  });
});

describe('isIgnored - built-in patterns', () => {
  it('should ignore node_modules paths', () => {
    const cwd = process.cwd();
    expect(isIgnored(join(cwd, 'node_modules/foo/index.js'))).toBe(true);
  });

  it('should ignore dist paths', () => {
    const cwd = process.cwd();
    expect(isIgnored(join(cwd, 'dist/index.js'))).toBe(true);
  });

  it('should ignore .DS_Store', () => {
    const cwd = process.cwd();
    expect(isIgnored(join(cwd, '.DS_Store'))).toBe(true);
  });

  it('should ignore package-lock.json', () => {
    const cwd = process.cwd();
    expect(isIgnored(join(cwd, 'package-lock.json'))).toBe(true);
  });

  it('should ignore .env files', () => {
    const cwd = process.cwd();
    expect(isIgnored(join(cwd, '.env'))).toBe(true);
    expect(isIgnored(join(cwd, '.env.local'))).toBe(true);
  });

  it('should not ignore regular source files', () => {
    const cwd = process.cwd();
    expect(isIgnored(join(cwd, 'src/index.ts'))).toBe(false);
    expect(isIgnored(join(cwd, 'README.md'))).toBe(false);
    expect(isIgnored(join(cwd, 'package.json'))).toBe(false);
  });
});

describe('isIgnored - global ignore file', () => {
  it('should respect patterns in ~/.threadlinkingignore', () => {
    writeFileSync(GLOBAL_IGNORE_PATH, '**/custom-ignore/**\n', 'utf-8');
    clearIgnoreCache();

    const cwd = process.cwd();
    expect(isIgnored(join(cwd, 'custom-ignore/file.ts'))).toBe(true);
    expect(isIgnored(join(cwd, 'src/index.ts'))).toBe(false);
  });

  it('should combine global patterns with built-in patterns', () => {
    writeFileSync(GLOBAL_IGNORE_PATH, '**/my-noise/**\n', 'utf-8');
    clearIgnoreCache();

    const cwd = process.cwd();
    // Built-in should still work
    expect(isIgnored(join(cwd, 'node_modules/foo/bar.js'))).toBe(true);
    // Global custom should also work
    expect(isIgnored(join(cwd, 'my-noise/file.ts'))).toBe(true);
  });

  it('should ignore comment lines in ignore file', () => {
    writeFileSync(GLOBAL_IGNORE_PATH, '# This is a comment\n**/actual-pattern/**\n', 'utf-8');
    clearIgnoreCache();

    const cwd = process.cwd();
    expect(isIgnored(join(cwd, 'actual-pattern/file.ts'))).toBe(true);
  });
});

describe('isIgnored - cache invalidation', () => {
  it('should pick up changes when ignore file is modified', () => {
    writeFileSync(GLOBAL_IGNORE_PATH, '**/old-pattern/**\n', 'utf-8');
    clearIgnoreCache();

    const cwd = process.cwd();
    expect(isIgnored(join(cwd, 'old-pattern/file.ts'))).toBe(true);
    expect(isIgnored(join(cwd, 'new-pattern/file.ts'))).toBe(false);

    // Modify the file
    writeFileSync(GLOBAL_IGNORE_PATH, '**/new-pattern/**\n', 'utf-8');
    clearIgnoreCache();

    expect(isIgnored(join(cwd, 'new-pattern/file.ts'))).toBe(true);
  });
});

describe('isIgnored - edge cases', () => {
  it('should not ignore the project root itself', () => {
    const cwd = process.cwd();
    expect(isIgnored(cwd)).toBe(false);
  });

  it('should handle paths outside the project root', () => {
    // Should not crash on arbitrary absolute paths
    expect(() => isIgnored('/tmp/some/random/file.ts')).not.toThrow();
  });
});
