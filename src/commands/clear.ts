import { Command } from 'commander';
import { createInterface } from 'readline';
import { loadIndex, saveIndex } from '../core/index.js';

function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export const clearCommand = new Command('clear')
  .description('Delete ALL threads from the index (dangerous)')
  .option('--yes', 'Skip confirmation prompts')
  .action(async (options) => {
    try {
      const index = loadIndex();

      if (Object.keys(index).length === 0) {
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

      saveIndex({});
      console.log('All threads deleted.');
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
    }
  });
