// Utility functions for threadlinking
// Shared by CLI and MCP server

import { resolve, dirname } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { createInterface } from 'readline';

// Security constants
export const MAX_SUMMARY_LENGTH = 500;
export const MAX_TAG_LENGTH = 100;
export const MAX_SNIPPET_LENGTH = 2000;
export const MAX_FILE_PATH_LENGTH = 1000;

export function sanitizeString(text: string, maxLength?: number): string {
  // Remove null bytes and control characters
  let sanitized = text.replace(/[\x00-\x1f]/g, (char) =>
    char === '\t' || char === '\n' || char === '\r' ? char : ''
  );

  // Apply length limit
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }

  return sanitized.trim();
}

export function validateTag(tag: string): string {
  if (!tag) {
    throw new Error('Tag cannot be empty');
  }

  if (tag.length > MAX_TAG_LENGTH) {
    throw new Error(`Tag too long (max ${MAX_TAG_LENGTH} characters)`);
  }

  // Check for dangerous characters
  if (/[<>"'&\n\r\0]/.test(tag)) {
    throw new Error('Tag contains invalid characters');
  }

  return sanitizeString(tag, MAX_TAG_LENGTH);
}

export function validateUrl(url: string): string {
  if (!url) return '';

  try {
    const parsed = new URL(url);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('URL scheme must be http or https');
    }

    return parsed.href;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Invalid URL format');
    }
    throw error;
  }
}

export function resolvePath(filePath: string): string {
  if (!filePath) {
    throw new Error('File path cannot be empty');
  }

  if (filePath.length > MAX_FILE_PATH_LENGTH) {
    throw new Error(`File path too long (max ${MAX_FILE_PATH_LENGTH} characters)`);
  }

  // Expand ~ to home directory
  const expanded = filePath.startsWith('~')
    ? filePath.replace('~', homedir())
    : filePath;

  return resolve(expanded);
}

export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toISOString().slice(0, 16).replace('T', ' ');
  } catch {
    return isoString;
  }
}

export function detectSource(): string {
  // Check for Claude Code environment
  if (process.env.CLAUDE_CODE || process.env.ANTHROPIC_API_KEY) {
    return 'claude-code';
  }

  // Check for other AI tools
  if (process.env.OPENAI_API_KEY) {
    return 'chatgpt';
  }

  return 'manual';
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function parseTags(tagString: string): string[] {
  return tagString
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
}

/**
 * Detect the project root for the current directory.
 * Returns null if not in a project directory (e.g., home directory).
 */
export function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export function detectProjectRoot(): string | null {
  const cwd = process.cwd();
  const home = homedir();

  // Don't treat home directory as a project
  if (cwd === home) {
    return null;
  }

  // Try git first (most reliable)
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    // Don't treat home directory as a project even if it's a git repo
    if (gitRoot === home) {
      return null;
    }

    return gitRoot;
  } catch {
    // Not a git repo, continue checking
  }

  // Check for project markers in current directory
  const markers = ['package.json', 'CLAUDE.md', 'pyproject.toml', 'Cargo.toml', '.git'];
  for (const marker of markers) {
    if (existsSync(marker)) {
      return cwd;
    }
  }

  // Walk up looking for project markers (but stop at home)
  let checkDir = cwd;
  while (checkDir !== '/' && checkDir !== home) {
    for (const marker of markers) {
      if (existsSync(`${checkDir}/${marker}`)) {
        return checkDir;
      }
    }
    checkDir = dirname(checkDir);
  }

  return null;
}
