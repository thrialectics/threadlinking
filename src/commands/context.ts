import { Command } from 'commander';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { basename, dirname } from 'path';
import { homedir } from 'os';
import { loadIndex, loadPending } from '../core/index.js';

/**
 * Detect the project root for the current directory.
 * Returns null if not in a project directory (e.g., home directory).
 */
function detectProjectRoot(): string | null {
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

export const contextCommand = new Command('context')
  .description('Show session context (threads and pending files for current project)')
  .option('--json', 'Output as JSON')
  .option('--global', 'Show all threads, not just current project')
  .action((options) => {
    const projectRoot = detectProjectRoot();
    const projectName = projectRoot ? basename(projectRoot) : null;

    const index = loadIndex();
    const pending = loadPending();

    const totalThreads = Object.keys(index).length;
    const totalPending = pending.tracked.length;

    // If no threadlinking data at all, exit silently
    if (totalThreads === 0 && totalPending === 0) {
      if (options.json) {
        console.log(JSON.stringify({ threads: [], pending: [], project: projectName }));
      }
      return;
    }

    // Filter to project if we're in one (unless --global)
    let relevantThreads: Array<{ id: string; summary: string; snippetCount: number; fileCount: number }> = [];
    let relevantPending: Array<{ path: string; basename: string; count: number }> = [];

    if (projectRoot && !options.global) {
      // Find threads with linked_files under project root
      for (const [id, thread] of Object.entries(index)) {
        const hasRelevantFile = thread.linked_files?.some((f) => f.startsWith(projectRoot));
        if (hasRelevantFile) {
          relevantThreads.push({
            id,
            summary: thread.summary,
            snippetCount: thread.snippets.length,
            fileCount: thread.linked_files?.length || 0,
          });
        }
      }

      // Find pending files under project root
      for (const file of pending.tracked) {
        if (file.path.startsWith(projectRoot)) {
          relevantPending.push({
            path: file.path,
            basename: basename(file.path),
            count: file.count,
          });
        }
      }
    } else {
      // Global view - all threads and pending
      for (const [id, thread] of Object.entries(index)) {
        relevantThreads.push({
          id,
          summary: thread.summary,
          snippetCount: thread.snippets.length,
          fileCount: thread.linked_files?.length || 0,
        });
      }

      for (const file of pending.tracked) {
        relevantPending.push({
          path: file.path,
          basename: basename(file.path),
          count: file.count,
        });
      }
    }

    // JSON output
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            project: projectName,
            projectRoot,
            threads: relevantThreads,
            pending: relevantPending,
            global: {
              totalThreads,
              totalPending,
            },
          },
          null,
          2
        )
      );
      return;
    }

    // No relevant data for this project
    if (relevantThreads.length === 0 && relevantPending.length === 0) {
      if (projectRoot) {
        // In a project but no threadlinking data for it - show global summary
        console.log(`=== Threadlinking (${projectName}) ===`);
        console.log(`No threads linked to this project.`);
        console.log(`Global: ${totalThreads} threads | ${totalPending} pending files`);
        console.log('===================================');
      }
      return;
    }

    // Concise summary output
    const header = projectRoot ? `=== Threadlinking: ${projectName} ===` : '=== Threadlinking (Global) ===';
    console.log(header);

    if (relevantThreads.length > 0) {
      const threadNames = relevantThreads.map((t) => t.id).join(', ');
      console.log(`Threads: ${threadNames}`);
    }

    if (relevantPending.length > 0) {
      console.log(`Pending: ${relevantPending.length} file${relevantPending.length === 1 ? '' : 's'} not yet linked`);
      // Show first few pending files
      const showCount = Math.min(3, relevantPending.length);
      for (let i = 0; i < showCount; i++) {
        console.log(`  - ${relevantPending[i].basename}`);
      }
      if (relevantPending.length > showCount) {
        console.log(`  ... and ${relevantPending.length - showCount} more`);
      }
    }

    console.log('='.repeat(header.length));
  });
