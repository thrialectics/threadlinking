import { Command } from 'commander';
import { listThreads, clearPending, truncate } from '../core/index.js';

const MAX_PENDING_DISPLAY = 8;

export const listCommand = new Command('list')
  .description('List all threads and untracked files')
  .option('--prefix <prefix>', 'Filter threads by prefix')
  .option('--since <days>', 'Filter threads from last N days', parseInt)
  .option('--clear-pending', 'Clear the pending files list')
  .action((options) => {
    // Handle --clear-pending
    if (options.clearPending) {
      const result = clearPending();
      console.log(result.message);
      return;
    }

    const result = listThreads({
      prefix: options.prefix,
      since: options.since,
      includePending: true,
    });

    if (!result.success) {
      console.error(`Error: ${result.message}`);
      return;
    }

    const { threads, pending } = result.data!;

    if (threads.length === 0) {
      console.log('No threads yet. Create one with: threadlinking snippet <name> "context"');
    } else {
      threads.forEach((t) => {
        const summary = truncate(t.summary || '', 60);
        console.log(`${t.id}  -  ${summary}`);
      });
    }

    // Show pending files
    if (pending.length > 0) {
      console.log();
      console.log(`Untracked files (${pending.length}):`);

      const toShow = pending.slice(0, MAX_PENDING_DISPLAY);
      toShow.forEach((f) => {
        const countInfo = f.count > 1 ? ` (modified ${f.count}x)` : '';
        console.log(`  ${f.basename}${countInfo}`);
        console.log(`    ${f.path}`);
      });

      if (pending.length > MAX_PENDING_DISPLAY) {
        console.log(`  ... and ${pending.length - MAX_PENDING_DISPLAY} more`);
      }

      console.log();
      console.log('Tip: threadlinking snippet <thread> "context" && threadlinking attach <thread> <file>');
    }
  });
