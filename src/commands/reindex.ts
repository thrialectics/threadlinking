import { Command } from 'commander';
import { rebuildSemanticIndex, cleanup } from '../core/operations/semantic.js';

export const reindexCommand = new Command('reindex')
  .description('Rebuild the semantic search index')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const result = await rebuildSemanticIndex((message) => {
        if (!options.json) {
          console.log(message);
        }
      });

      if (!result.success) {
        if (options.json) {
          console.log(JSON.stringify({ error: result.message }, null, 2));
        } else {
          console.error(`Error: ${result.message}`);
          if (result.message?.includes('No threads') || result.message?.includes('No content')) {
            console.error('Tip: Create some snippets first with `threadlinking snippet <thread> "context"`');
          }
        }
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(result.data, null, 2));
      } else {
        console.log(result.message);
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
