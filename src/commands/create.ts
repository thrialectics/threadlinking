import { Command } from 'commander';
import { createThread } from '../core/index.js';

export const createCommand = new Command('create')
  .description('Create a new empty thread')
  .argument('<thread_id>', 'Thread name (e.g., "myproject")')
  .option('--summary <summary>', 'Thread description')
  .option('--chat-url <url>', 'Associated chat URL')
  .action(async (threadId: string, options) => {
    const result = createThread({
      threadId,
      summary: options.summary,
      chatUrl: options.chatUrl,
    });

    if (!result.success) {
      console.error(`Error: ${result.message}`);
      if (result.message?.includes('already exists')) {
        console.error('Tip: Use `threadlinking show <thread>` to view it, or choose a different name.');
      }
      process.exitCode = 1;
      return;
    }

    console.log(result.message);
    console.log(`Thread "${threadId}" is ready for snippets and file attachments.`);
  });
