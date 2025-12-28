import { Command } from 'commander';
import { loadIndex, saveIndex } from '../storage.js';
import { validateTag, resolvePath } from '../utils.js';

export const detachCommand = new Command('detach')
  .description('Remove a file from a thread')
  .argument('<thread_id>', 'Thread tag or UUID')
  .argument('<file>', 'Path to the file to detach')
  .action((threadId: string, file: string) => {
    try {
      const index = loadIndex();
      const validatedId = validateTag(threadId);

      if (!index[validatedId]) {
        console.error(`Thread ID '${validatedId}' not found.`);
        return;
      }

      const resolvedPath = resolvePath(file);
      const files = index[validatedId].linked_files || [];
      const idx = files.indexOf(resolvedPath);

      if (idx === -1) {
        console.error(`File '${resolvedPath}' is not linked to thread '${validatedId}'.`);
        return;
      }

      files.splice(idx, 1);
      index[validatedId].linked_files = files;
      index[validatedId].date_modified = new Date().toISOString();

      saveIndex(index);
      console.log(`File '${resolvedPath}' detached from thread '${validatedId}'.`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
    }
  });
