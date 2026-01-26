import { Command } from 'commander';
import { loadIndex, saveIndex, validateTag } from '../core/index.js';

export const renameCommand = new Command('rename')
  .description('Rename a thread tag')
  .argument('<old_id>', 'Current thread tag')
  .argument('<new_id>', 'New thread tag')
  .action((oldId: string, newId: string) => {
    try {
      const index = loadIndex();
      const validatedOld = validateTag(oldId);
      const validatedNew = validateTag(newId);

      if (!index[validatedOld]) {
        console.error(`Thread ID '${validatedOld}' not found.`);
        return;
      }

      if (index[validatedNew]) {
        console.error(`Target ID '${validatedNew}' already exists.`);
        return;
      }

      index[validatedNew] = index[validatedOld];
      delete index[validatedOld];
      index[validatedNew].date_modified = new Date().toISOString();

      saveIndex(index);
      console.log(`Renamed '${validatedOld}' -> '${validatedNew}'.`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
    }
  });
