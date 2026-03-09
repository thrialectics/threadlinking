import { Command } from 'commander';
import { relateThreads } from '../core/index.js';

export const relateCommand = new Command('relate')
  .description('Link two threads as related')
  .argument('<thread>', 'First thread')
  .argument('<other_thread>', 'Second thread')
  .action(async (threadId: string, otherThread: string) => {
    const result = relateThreads(threadId, otherThread);
    if (!result.success) {
      console.error(`Error: ${result.message}`);
      if (result.message?.includes('not found')) {
        console.error('Tip: Run `threadlinking list` to see available threads.');
      }
      process.exitCode = 1;
      return;
    }
    console.log(result.message);
  });
