import { Command } from 'commander';
import {
  updateThread,
  loadMetaIndex,
  validateTag,
  validateUrl,
  sanitizeString,
  MAX_SUMMARY_LENGTH,
} from '../core/index.js';

export const updateCommand = new Command('update')
  .description("Update a thread's summary or chat URL")
  .argument('<thread_id>', 'Thread tag or UUID')
  .option('--summary <summary>', 'New summary')
  .option('--chat_url <url>', 'New chat URL')
  .action((threadId: string, options) => {
    try {
      if (!options.summary && options.chat_url === undefined) {
        console.error('Nothing to update. Provide --summary and/or --chat_url');
        process.exitCode = 1;
        return;
      }

      const validatedId = validateTag(threadId);

      // Check existence via meta index (fast)
      const meta = loadMetaIndex();
      if (!meta.threads[validatedId]) {
        console.error(`Thread ID '${validatedId}' not found.`);
        process.exitCode = 1;
        return;
      }

      updateThread(validatedId, (thread) => {
        if (options.summary) {
          thread.summary = sanitizeString(options.summary, MAX_SUMMARY_LENGTH);
        }

        if (options.chat_url !== undefined) {
          thread.chat_url = validateUrl(options.chat_url);
        }

        thread.date_modified = new Date().toISOString();
        return thread;
      });

      console.log('Thread updated.');
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
    }
  });
