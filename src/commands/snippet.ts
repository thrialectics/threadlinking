import { Command } from 'commander';
import { readFileSync } from 'fs';
import { addSnippet, truncate, parseTags, detectSource } from '../core/index.js';

export const snippetCommand = new Command('snippet')
  .description('Add a conversation snippet to a thread (auto-creates if needed)')
  .argument('<thread_id>', "Thread tag (will be created if doesn't exist)")
  .argument('[content]', 'Snippet content (the relevant excerpt)')
  .option('--file <path>', 'Read snippet content from a file instead')
  .option('--source <source>', 'Source of snippet (claude-code, chatgpt, claude-desktop, manual)')
  .option('--url <url>', 'Optional URL to the conversation')
  .option('--summary <summary>', 'Summary for auto-created threads')
  .option('--tags <tags>', 'Comma-separated tags (e.g., auth,decision)')
  .action(async (threadId: string, content: string | undefined, options) => {
    // Get snippet content
    let snippetContent: string;
    if (options.file) {
      try {
        snippetContent = readFileSync(options.file, 'utf-8');
      } catch (error) {
        console.error(`Error reading file: ${error}`);
        return;
      }
    } else if (content) {
      snippetContent = content;
    } else {
      console.error('Snippet content cannot be empty');
      return;
    }

    // Parse tags if provided
    const tags = options.tags ? parseTags(options.tags) : undefined;

    // Call core operation
    const result = await addSnippet({
      threadId,
      content: snippetContent,
      source: options.source || detectSource(),
      url: options.url,
      tags,
      summary: options.summary,
    });

    if (!result.success) {
      console.error(`Error: ${result.message}`);
      return;
    }

    console.log(result.message);

    // Preview
    const preview = truncate(snippetContent.trim(), 100);
    const source = options.source || detectSource();
    const tagsDisplay = tags?.length ? ` [${tags.join(', ')}]` : '';
    console.log(`   [${source}]${tagsDisplay} ${preview}`);
  });
