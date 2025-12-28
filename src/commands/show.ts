import { Command } from 'commander';
import { loadIndex } from '../storage.js';
import { validateTag, formatDate, truncate } from '../utils.js';

export const showCommand = new Command('show')
  .description('Show thread details')
  .argument('<thread_id>', 'Thread tag or UUID')
  .option('--json', 'Output as JSON')
  .action((threadId: string, options) => {
    try {
      const index = loadIndex();
      const validatedId = validateTag(threadId);

      if (!index[validatedId]) {
        console.error(`Thread ID '${validatedId}' not found.`);
        return;
      }

      const thread = index[validatedId];

      // JSON output mode
      if (options.json) {
        console.log(JSON.stringify(thread, null, 2));
        return;
      }

      // Human-readable output
      console.log();
      console.log(`  ${validatedId}`);
      console.log(`  ${'─'.repeat(validatedId.length)}`);
      console.log(`  ${thread.summary || '(no summary)'}`);

      if (thread.chat_url) {
        console.log();
        console.log(`  URL: ${thread.chat_url}`);
      }

      const created = thread.date_created || '';
      const modified = thread.date_modified || '';

      if (created) {
        console.log(`  Created: ${formatDate(created)}`);
      }
      if (modified && modified !== created) {
        console.log(`  Modified: ${formatDate(modified)}`);
      }

      // Show snippets
      const snippets = thread.snippets || [];
      if (snippets.length > 0) {
        console.log();
        console.log(`  Snippets (${snippets.length}):`);

        snippets.forEach((s, i) => {
          const source = s.source || 'unknown';
          const ts = formatDate(s.timestamp || '');
          const content = s.content || '';
          const lines = content.split('\n');
          const preview = truncate(lines[0], 70);

          console.log();
          console.log(`  [${i + 1}] ${source} @ ${ts}`);
          console.log(`      ${preview}`);

          if (s.url) {
            console.log(`      (${s.url})`);
          }
        });
      }

      // Show linked files
      const files = thread.linked_files || [];
      if (files.length > 0) {
        console.log();
        console.log(`  Linked files (${files.length}):`);
        files.forEach((f) => {
          console.log(`    - ${f}`);
        });
      }

      console.log();
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
    }
  });
