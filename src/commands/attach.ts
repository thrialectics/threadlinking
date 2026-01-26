import { Command } from 'commander';
import { attachFile } from '../core/index.js';

export const attachCommand = new Command('attach')
  .description('Attach a file to a thread')
  .argument('<thread_id>', 'Thread tag or UUID')
  .argument('<file>', 'Path to the file to attach')
  .action((threadId: string, file: string) => {
    const result = attachFile({ threadId, filePath: file });

    if (!result.success) {
      console.error(`Error: ${result.message}`);
      return;
    }

    console.log(result.message);
  });
