import { Command } from 'commander';
import { readFileSync } from 'fs';
import { loadIndex, saveIndex } from '../storage.js';
import {
  validateTag,
  validateUrl,
  sanitizeString,
  detectSource,
  truncate,
  MAX_SNIPPET_LENGTH,
  MAX_SUMMARY_LENGTH,
} from '../utils.js';
import type { Snippet, Thread } from '../types.js';

export const snippetCommand = new Command('snippet')
  .description('Add a conversation snippet to a thread (auto-creates if needed)')
  .argument('<thread_id>', 'Thread tag (will be created if doesn\'t exist)')
  .argument('[content]', 'Snippet content (the relevant excerpt)')
  .option('--file <path>', 'Read snippet content from a file instead')
  .option('--source <source>', 'Source of snippet (claude-code, chatgpt, claude-desktop, manual)')
  .option('--url <url>', 'Optional URL to the conversation')
  .option('--summary <summary>', 'Summary for auto-created threads')
  .option('--tags <tags>', 'Comma-separated tags (e.g., auth,decision)')
  .action((threadId: string, content: string | undefined, options) => {
    try {
      const index = loadIndex();
      const validatedId = validateTag(threadId);

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

      if (!snippetContent.trim()) {
        console.error('Snippet content cannot be empty');
        return;
      }

      // Sanitize and limit
      snippetContent = sanitizeString(snippetContent.trim(), MAX_SNIPPET_LENGTH);

      // Determine source
      const source = options.source || detectSource();

      // Create snippet object
      const snippet: Snippet = {
        content: snippetContent,
        source,
        timestamp: new Date().toISOString(),
      };

      if (options.url) {
        snippet.url = validateUrl(options.url);
      }

      // Parse and add tags
      if (options.tags) {
        const tags = options.tags
          .split(',')
          .map((t: string) => t.trim().toLowerCase())
          .filter((t: string) => t.length > 0);
        if (tags.length > 0) {
          snippet.tags = tags;
        }
      }

      // Auto-create thread if needed
      let createdNew = false;
      if (!index[validatedId]) {
        let summary: string;
        if (options.summary) {
          summary = sanitizeString(options.summary, MAX_SUMMARY_LENGTH);
        } else {
          // Use first 80 chars of snippet as summary
          const firstLine = snippetContent.split('\n')[0].slice(0, 80);
          summary = firstLine.length < 10
            ? snippetContent.slice(0, 80)
            : firstLine;
          if (snippetContent.length > 80) summary += '...';
        }

        index[validatedId] = {
          summary,
          snippets: [],
          linked_files: [],
          chat_url: '',
          date_created: new Date().toISOString(),
        };
        createdNew = true;
      }

      // Ensure snippets array exists (for old threads)
      if (!index[validatedId].snippets) {
        index[validatedId].snippets = [];
      }

      // Add snippet
      index[validatedId].snippets.push(snippet);
      index[validatedId].date_modified = new Date().toISOString();

      saveIndex(index);

      if (createdNew) {
        console.log(`Created thread '${validatedId}' with snippet`);
      } else {
        const count = index[validatedId].snippets.length;
        console.log(`Added snippet to '${validatedId}' (${count} snippet${count > 1 ? 's' : ''} total)`);
      }

      // Preview
      const preview = truncate(snippetContent, 100);
      const tagsDisplay = snippet.tags ? ` [${snippet.tags.join(', ')}]` : '';
      console.log(`   [${source}]${tagsDisplay} ${preview}`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
    }
  });
