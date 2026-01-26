import { Command } from 'commander';
import {
  loadIndex,
  saveIndex,
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
        return;
      }

      const index = loadIndex();
      const validatedId = validateTag(threadId);

      if (!index[validatedId]) {
        console.error(`Thread ID '${validatedId}' not found.`);
        return;
      }

      if (options.summary) {
        index[validatedId].summary = sanitizeString(options.summary, MAX_SUMMARY_LENGTH);
      }

      if (options.chat_url !== undefined) {
        index[validatedId].chat_url = validateUrl(options.chat_url);
      }

      index[validatedId].date_modified = new Date().toISOString();

      saveIndex(index);
      console.log('Thread updated.');
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
    }
  });
