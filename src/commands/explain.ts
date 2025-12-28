import { Command } from 'commander';
import { loadIndex } from '../storage.js';
import { resolvePath, formatDate, truncate } from '../utils.js';

export const explainCommand = new Command('explain')
  .description('Show thread context for a file')
  .argument('<file>', 'File to explain')
  .option('--json', 'Output as JSON')
  .option('--brief', 'Brief output (thread IDs and summaries only)')
  .action((file: string, options) => {
    try {
      const index = loadIndex();
      const resolvedPath = resolvePath(file);

      // Find all threads that link to this file
      const hits = Object.entries(index)
        .filter(([_, thread]) =>
          thread.linked_files?.includes(resolvedPath)
        )
        .map(([id, thread]) => ({ thread_id: id, ...thread }));

      if (hits.length === 0) {
        console.log('No ThreadLink context for that file.');
        return;
      }

      // JSON output
      if (options.json) {
        console.log(JSON.stringify(hits, null, 2));
        return;
      }

      // Brief mode
      if (options.brief) {
        hits.forEach((h) => {
          console.log(`${h.thread_id}: ${truncate(h.summary || '(no summary)', 60)}`);
        });
        return;
      }

      // Full mode with snippets
      hits.forEach((h) => {
        console.log();
        console.log(`  ${h.thread_id}  (${formatDate(h.date_created || '')})`);
        console.log(`  ${h.summary || '(no summary)'}`);

        if (h.chat_url) {
          console.log(`  URL: ${h.chat_url}`);
        }

        // Show snippets - the key context
        const snippets = h.snippets || [];
        if (snippets.length > 0) {
          console.log();
          console.log(`  Context (${snippets.length} snippet${snippets.length > 1 ? 's' : ''}):`);

          snippets.forEach((s, i) => {
            const source = s.source || 'unknown';
            const ts = formatDate(s.timestamp || '');
            const content = s.content || '';
            const lines = content.split('\n');

            console.log();
            console.log(`  [${i + 1}] ${source} @ ${ts}`);

            // Show up to 3 lines
            lines.slice(0, 3).forEach((line) => {
              console.log(`      ${truncate(line, 80)}`);
            });

            if (lines.length > 3) {
              console.log(`      ... (${lines.length - 3} more lines)`);
            }

            if (s.url) {
              console.log(`      Link: ${s.url}`);
            }
          });
        }

        console.log();
      });
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
    }
  });
