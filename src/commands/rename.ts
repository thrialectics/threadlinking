import { Command } from 'commander';
import { loadThread, saveThread, deleteThreadFile, loadMetaIndex, validateTag } from '../core/index.js';

export const renameCommand = new Command('rename')
  .description('Rename a thread tag')
  .argument('<old_id>', 'Current thread tag')
  .argument('<new_id>', 'New thread tag')
  .action((oldId: string, newId: string) => {
    try {
      const validatedOld = validateTag(oldId);
      const validatedNew = validateTag(newId);

      // Check via meta index
      const meta = loadMetaIndex();

      if (!meta.threads[validatedOld]) {
        console.error(`Thread ID '${validatedOld}' not found.`);
        console.error('Tip: Run `threadlinking list` to see available threads.');
        process.exitCode = 1;
        return;
      }

      if (meta.threads[validatedNew]) {
        console.error(`Target ID '${validatedNew}' already exists.`);
        console.error('Tip: Use `threadlinking show <thread>` to view it, or choose a different name.');
        process.exitCode = 1;
        return;
      }

      // Load the old thread
      const thread = loadThread(validatedOld);
      if (!thread) {
        console.error(`Thread ID '${validatedOld}' not found.`);
        console.error('Tip: Run `threadlinking list` to see available threads.');
        process.exitCode = 1;
        return;
      }

      // Update date_modified
      thread.date_modified = new Date().toISOString();

      // Save as new thread, delete old
      saveThread(validatedNew, thread);
      deleteThreadFile(validatedOld);

      console.log(`Renamed '${validatedOld}' -> '${validatedNew}'.`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
    }
  });
