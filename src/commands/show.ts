import { Command } from 'commander';
import { showThread, formatDate, truncate } from '../core/index.js';

export const showCommand = new Command('show')
  .description('Show thread details')
  .argument('<thread_id>', 'Thread tag or UUID')
  .option('--json', 'Output as JSON')
  .option('--tag <tag>', 'Filter snippets by tag')
  .action((threadId: string, options) => {
    const result = showThread(threadId, { filterTag: options.tag });

    if (!result.success) {
      console.error(`Error: ${result.message}`);
      return;
    }

    const { threadId: validatedId, thread } = result.data!;

    // JSON output mode
    if (options.json) {
      console.log(JSON.stringify(thread, null, 2));
      return;
    }

    // Human-readable output
    console.log();
    console.log(`  ${validatedId}`);
    console.log(`  ${'─'.repeat(validatedId.length)}`);
    console.log(`  ${thread.summary || '(no summary)'}`);

    if (thread.chat_url) {
      console.log();
      console.log(`  URL: ${thread.chat_url}`);
    }

    const created = thread.date_created || '';
    const modified = thread.date_modified || '';

    if (created) {
      console.log(`  Created: ${formatDate(created)}`);
    }
    if (modified && modified !== created) {
      console.log(`  Modified: ${formatDate(modified)}`);
    }

    // Show snippets
    const snippets = thread.snippets || [];
    const filterTag = options.tag?.toLowerCase();

    if (snippets.length > 0) {
      const filterNote = filterTag ? ` (filtered by: ${filterTag})` : '';
      console.log();
      console.log(`  Snippets (${snippets.length})${filterNote}:`);

      snippets.forEach((s, i) => {
        const source = s.source || 'unknown';
        const ts = formatDate(s.timestamp || '');
        const content = s.content || '';
        const lines = content.split('\n');
        const preview = truncate(lines[0], 70);
        const tagsDisplay = s.tags?.length ? ` [${s.tags.join(', ')}]` : '';

        console.log();
        console.log(`  [${i + 1}] ${source} @ ${ts}${tagsDisplay}`);
        console.log(`      ${preview}`);

        if (s.url) {
          console.log(`      (${s.url})`);
        }
      });
    } else if (filterTag) {
      console.log();
      console.log(`  No snippets with tag: ${filterTag}`);
    }

    // Show linked files
    const files = thread.linked_files || [];
    if (files.length > 0) {
      console.log();
      console.log(`  Linked files (${files.length}):`);
      files.forEach((f) => {
        console.log(`    - ${f}`);
      });
    }

    console.log();
  });
