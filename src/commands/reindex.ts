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
      // Clean up Python process
      cleanup();
    }
  });
