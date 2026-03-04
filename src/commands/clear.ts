import { Command } from 'commander';
import { loadMetaIndex, deleteThreadFile, prompt } from '../core/index.js';

export const clearCommand = new Command('clear')
  .description('Delete ALL threads from the index (dangerous)')
  .option('--yes', 'Skip confirmation prompts')
  .action(async (options) => {
    try {
      const meta = loadMetaIndex();
      const threadIds = Object.keys(meta.threads);

      if (threadIds.length === 0) {
        console.log('Index is already empty.');
        return;
      }

      if (!options.yes) {
        const confirm1 = await prompt(
          'Are you sure you want to delete ALL threads? This cannot be undone. (y/N): '
        );
        if (confirm1.toLowerCase() !== 'y') {
          console.log('Aborted.');
          return;
        }

        const confirm2 = await prompt("Type 'clear' to confirm: ");
        if (confirm2.toLowerCase() !== 'clear') {
          console.log('Aborted.');
          return;
        }
      }

      // Delete each thread file
      for (const id of threadIds) {
        deleteThreadFile(id);
      }

      console.log('All threads deleted.');
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
    }
  });
