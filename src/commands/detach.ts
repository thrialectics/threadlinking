import { Command } from 'commander';
import { detachFile } from '../core/index.js';

export const detachCommand = new Command('detach')
  .description('Remove a file from a thread')
  .argument('<thread_id>', 'Thread tag or UUID')
  .argument('<file>', 'Path to the file to detach')
  .action((threadId: string, file: string) => {
    const result = detachFile({ threadId, filePath: file });

    if (!result.success) {
      console.error(`Error: ${result.message}`);
      return;
    }

    console.log(result.message);
  });
