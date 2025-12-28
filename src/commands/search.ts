import { Command } from 'commander';
import { loadIndex } from '../storage.js';
import { sanitizeString } from '../utils.js';

export const searchCommand = new Command('search')
  .description('Search threads by keyword')
  .argument('<query>', 'Keyword to search')
  .option('--json', 'Output as JSON')
  .action((query: string, options) => {
    try {
      const index = loadIndex();
      const searchQuery = sanitizeString(query, 100).toLowerCase();

      if (!searchQuery) {
        console.error('Search query cannot be empty');
        return;
      }

      const results = Object.entries(index).filter(([id, thread]) => {
        const summary = (thread.summary || '').toLowerCase();
        const idLower = id.toLowerCase();

        // Search in ID and summary
        if (idLower.includes(searchQuery) || summary.includes(searchQuery)) {
          return true;
        }

        // Search in snippets
        const snippets = thread.snippets || [];
        return snippets.some((s) =>
          (s.content || '').toLowerCase().includes(searchQuery)
        );
      });

      if (results.length === 0) {
        console.log('No matching threads found.');
        return;
      }

      if (options.json) {
        const output = Object.fromEntries(results);
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      results.forEach(([id, thread]) => {
        console.log(`${id}: ${thread.summary || '(no summary)'}`);
      });
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
    }
  });
