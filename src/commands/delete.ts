import { Command } from 'commander';
import { createInterface } from 'readline';
import { loadIndex, saveIndex, validateTag } from '../core/index.js';

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

export const deleteCommand = new Command('delete')
  .description('Delete a thread')
  .argument('<thread_id>', 'Thread tag or UUID')
  .option('--yes', 'Skip confirmation')
  .action(async (threadId: string, options) => {
    try {
      const index = loadIndex();
      const validatedId = validateTag(threadId);

      if (!index[validatedId]) {
        console.error(`Thread ID '${validatedId}' not found.`);
        return;
      }

      if (!options.yes) {
        const answer = await prompt(
          `Delete thread '${validatedId}'? This cannot be undone. (y/N): `
        );
        if (answer.toLowerCase() !== 'y') {
          console.log('Aborted.');
          return;
        }
      }

      delete index[validatedId];
      saveIndex(index);
      console.log(`Deleted thread '${validatedId}'.`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
    }
  });
