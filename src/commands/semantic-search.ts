import { Command } from 'commander';
import { semanticSearch, cleanup } from '../core/operations/semantic.js';

export const semanticSearchCommand = new Command('semantic-search')
  .description('Search threads by semantic similarity')
  .argument('<query>', 'Natural language query')
  .option('-n, --limit <number>', 'Maximum results', '10')
  .option('--json', 'Output as JSON')
  .action(async (query: string, options) => {
    try {
      const limit = parseInt(options.limit, 10) || 10;
      const result = await semanticSearch(query, limit);

      if (!result.success) {
        if (options.json) {
          console.log(JSON.stringify({ error: result.message }, null, 2));
        } else {
          console.error(`Error: ${result.message}`);
        }
        process.exit(1);
      }

      const { results, staleWarning } = result.data!;

      if (options.json) {
        console.log(JSON.stringify(result.data, null, 2));
        return;
      }

      // Show stale warning if present
      if (staleWarning) {
        console.log(`\x1b[33mWarning: ${staleWarning}\x1b[0m\n`);
      }

      if (results.length === 0) {
        console.log('No semantically similar threads found.');
        return;
      }

      console.log(`Found ${results.length} similar thread(s):\n`);

      for (const { id, thread, score, matchedSnippets } of results) {
        const scorePercent = Math.round(score * 100);
        console.log(`\x1b[1m${id}\x1b[0m (${scorePercent}% match)`);
        console.log(`  ${thread.summary || '(no summary)'}`);

        if (matchedSnippets.length > 0) {
          const snippetCount = matchedSnippets.length;
          console.log(`  \x1b[90m${snippetCount} matching snippet(s)\x1b[0m`);
        }

        console.log();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(`Error: ${message}`);
      }
      process.exit(1);
    } finally {
      cleanup();
    }
  });
