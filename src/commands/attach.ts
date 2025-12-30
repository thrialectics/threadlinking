import { Command } from 'commander';
import { existsSync } from 'fs';
import { loadIndex, saveIndex, removeFromPending } from '../storage.js';
import { validateTag, resolvePath } from '../utils.js';

export const attachCommand = new Command('attach')
  .description('Attach a file to a thread')
  .argument('<thread_id>', 'Thread tag or UUID')
  .argument('<file>', 'Path to the file to attach')
  .action((threadId: string, file: string) => {
    try {
      const index = loadIndex();
      const validatedId = validateTag(threadId);

      if (!index[validatedId]) {
        console.error(`Thread ID '${validatedId}' not found.`);
        return;
      }

      const resolvedPath = resolvePath(file);

      if (!existsSync(resolvedPath)) {
        console.warn(`Warning: File '${resolvedPath}' does not exist.`);
      }

      const files = index[validatedId].linked_files || [];

      if (files.includes(resolvedPath)) {
        console.log(`File '${resolvedPath}' is already linked to thread '${validatedId}'.`);
        return;
      }

      files.push(resolvedPath);
      index[validatedId].linked_files = files;
      index[validatedId].date_modified = new Date().toISOString();

      saveIndex(index);

      // Remove from pending if it was tracked
      removeFromPending(resolvedPath);

      console.log(`File '${resolvedPath}' attached to thread '${validatedId}'.`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
    }
  });
