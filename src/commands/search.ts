import { Command } from 'commander';
import { searchThreads } from '../core/index.js';

export const searchCommand = new Command('search')
  .description('Search threads by keyword')
  .argument('<query>', 'Keyword to search')
  .option('--json', 'Output as JSON')
  .action((query: string, options) => {
    const result = searchThreads(query);

    if (!result.success) {
      console.error(`Error: ${result.message}`);
      return;
    }

    const { results } = result.data!;

    if (results.length === 0) {
      console.log('No matching threads found.');
      return;
    }

    if (options.json) {
      const output = Object.fromEntries(results.map((r) => [r.id, r.thread]));
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    results.forEach(({ id, thread }) => {
      console.log(`${id}: ${thread.summary || '(no summary)'}`);
    });
  });
