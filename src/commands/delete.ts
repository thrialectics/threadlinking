import { Command } from 'commander';
import { validateTag, prompt, deleteThread } from '../core/index.js';

export const deleteCommand = new Command('delete')
  .description('Delete a thread')
  .argument('<thread_id>', 'Thread tag or UUID')
  .option('--yes', 'Skip confirmation prompts')
  .action(async (threadId: string, options) => {
    try {
      const validatedId = validateTag(threadId);

      if (!options.yes) {
        const answer = await prompt(
          `Delete thread '${validatedId}'? This cannot be undone. (y/N): `
        );
        if (answer.toLowerCase() !== 'y') {
          console.log('Aborted.');
          return;
        }
      }

      const result = await deleteThread({ threadId: validatedId });

      if (!result.success) {
        console.error(result.message);
        if (result.error === 'THREAD_NOT_FOUND') {
          console.error('Tip: Run `threadlinking list` to see available threads.');
        }
        process.exitCode = 1;
        return;
      }

      console.log(result.message);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
    }
  });
