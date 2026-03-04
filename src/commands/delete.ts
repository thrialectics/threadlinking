import { Command } from 'commander';
import { deleteThreadFile, loadMetaIndex, validateTag, prompt } from '../core/index.js';
import { getSemanticIndex } from '../embeddings/index.js';

export const deleteCommand = new Command('delete')
  .description('Delete a thread')
  .argument('<thread_id>', 'Thread tag or UUID')
  .option('--yes', 'Skip confirmation prompts')
  .action(async (threadId: string, options) => {
    try {
      const validatedId = validateTag(threadId);

      // Check existence via meta index
      const meta = loadMetaIndex();
      if (!meta.threads[validatedId]) {
        console.error(`Thread ID '${validatedId}' not found.`);
        process.exitCode = 1;
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

      deleteThreadFile(validatedId);

      // Clean up semantic index embeddings for the deleted thread
      try {
        const semanticIndex = await getSemanticIndex();
        await semanticIndex.deleteThread(validatedId);
      } catch {
        // Non-fatal: semantic index may not exist
      }

      console.log(`Deleted thread '${validatedId}'.`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
    }
  });
