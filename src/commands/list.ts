import { Command } from 'commander';
import { basename } from 'path';
import { loadIndex, loadPending, savePending } from '../storage.js';
import { truncate } from '../utils.js';

const MAX_PENDING_DISPLAY = 8;

export const listCommand = new Command('list')
  .description('List all threads and untracked files')
  .option('--prefix <prefix>', 'Filter threads by prefix')
  .option('--since <days>', 'Filter threads from last N days', parseInt)
  .option('--clear-pending', 'Clear the pending files list')
  .action((options) => {
    try {
      const index = loadIndex();
      const now = new Date();

      // Handle --clear-pending
      if (options.clearPending) {
        savePending({ tracked: [] });
        console.log('Pending files cleared.');
        return;
      }

      const entries = Object.entries(index).filter(([id, thread]) => {
        // Filter by prefix
        if (options.prefix && !id.startsWith(options.prefix)) {
          return false;
        }

        // Filter by age
        if (options.since !== undefined) {
          const ts = thread.date_modified || thread.date_created;
          if (ts) {
            const date = new Date(ts);
            const daysOld = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
            if (daysOld > options.since) {
              return false;
            }
          }
        }

        return true;
      });

      if (entries.length === 0) {
        console.log('No threads found.');
      } else {
        entries.forEach(([id, thread]) => {
          const summary = truncate(thread.summary || '', 60);
          console.log(`${id}  -  ${summary}`);
        });
      }

      // Show pending files
      const pending = loadPending();

      // Filter out files already linked to any thread
      const allLinkedFiles = new Set(
        Object.values(index).flatMap((t) => t.linked_files || [])
      );

      const untracked = pending.tracked.filter((f) => !allLinkedFiles.has(f.path));

      if (untracked.length > 0) {
        console.log();
        console.log(`Untracked files (${untracked.length}):`);

        // Sort by last_modified descending
        untracked.sort((a, b) =>
          new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime()
        );

        const toShow = untracked.slice(0, MAX_PENDING_DISPLAY);
        toShow.forEach((f) => {
          const name = basename(f.path);
          const countInfo = f.count > 1 ? ` (modified ${f.count}x)` : '';
          console.log(`  ${name}${countInfo}`);
          console.log(`    ${f.path}`);
        });

        if (untracked.length > MAX_PENDING_DISPLAY) {
          console.log(`  ... and ${untracked.length - MAX_PENDING_DISPLAY} more`);
        }

        console.log();
        console.log('Tip: threadlinking snippet <thread> "context" && threadlinking attach <thread> <file>');
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
    }
  });
