import { Command } from 'commander';
import { loadIndex } from '../storage.js';
import { truncate } from '../utils.js';

export const listCommand = new Command('list')
  .description('List all threads')
  .option('--prefix <prefix>', 'Filter threads by prefix')
  .option('--since <days>', 'Filter threads from last N days', parseInt)
  .action((options) => {
    try {
      const index = loadIndex();
      const now = new Date();

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
        return;
      }

      entries.forEach(([id, thread]) => {
        const summary = truncate(thread.summary || '', 60);
        console.log(`${id}  -  ${summary}`);
      });
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
    }
  });
