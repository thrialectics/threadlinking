import { Command } from 'commander';
import { existsSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { loadIndex, updatePending, resolvePath } from '../core/index.js';
import { isIgnored } from '../core/ignore.js';

export const trackCommand = new Command('track')
  .description('Track a file for later context (called by hooks)')
  .argument('<file>', 'Path to the file to track')
  .option('--quiet', 'Suppress output')
  .action((file: string, options) => {
    try {
      const resolvedPath = resolvePath(file);

      // Skip non-existent files (might be temp files)
      if (!existsSync(resolvedPath)) {
        return;
      }

      // Skip ignored files (build artifacts, node_modules, etc.)
      if (isIgnored(resolvedPath)) {
        return;
      }

      // Skip files already linked to a thread
      // (Note: this read could be slightly stale, but worst case we track
      // a file that's already linked - harmless, filtered out later)
      const index = loadIndex();
      const alreadyLinked = Object.values(index).some((thread) =>
        thread.linked_files?.includes(resolvedPath)
      );

      if (alreadyLinked) {
        return;
      }

      // Add or update in pending with locking to prevent race conditions
      const now = new Date().toISOString();
      let wasTracked = false;

      updatePending((pending) => {
        const existing = pending.tracked.find((f) => f.path === resolvedPath);

        if (existing) {
          existing.last_modified = now;
          existing.count += 1;
        } else {
          pending.tracked.push({
            path: resolvedPath,
            first_seen: now,
            last_modified: now,
            count: 1,
          });
        }

        wasTracked = true;
        return pending;
      });

      if (!options.quiet && wasTracked) {
        console.log(`Tracked: ${resolvedPath}`);
      }
    } catch (error) {
      try {
        const logPath = join(homedir(), '.threadlinking', 'debug.log');
        const timestamp = new Date().toISOString();
        const message = error instanceof Error ? error.message : String(error);
        appendFileSync(logPath, `[${timestamp}] track error: ${message}\n`);
      } catch {
        // If we can't even log, truly swallow
      }
    }
  });
