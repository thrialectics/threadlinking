import { Command } from 'commander';
import { existsSync } from 'fs';
import { loadIndex, loadPending, savePending, resolvePath } from '../core/index.js';

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

      // Skip files already linked to a thread
      const index = loadIndex();
      const alreadyLinked = Object.values(index).some((thread) =>
        thread.linked_files?.includes(resolvedPath)
      );

      if (alreadyLinked) {
        return;
      }

      // Add or update in pending
      const pending = loadPending();
      const now = new Date().toISOString();

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

      savePending(pending);

      if (!options.quiet) {
        console.log(`Tracked: ${resolvedPath}`);
      }
    } catch {
      // Fail silently - this runs on every file write
    }
  });
