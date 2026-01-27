// MCP Server for threadlinking
// Exposes core operations as MCP tools

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  // Core operations
  addSnippet,
  createThread,
  attachFile,
  detachFile,
  explainFile,
  showThread,
  listThreads,
  searchThreads,
  // Advanced operations
  semanticSearch,
  getAnalytics,
  exportThread,
} from '../core/index.js';
import { VERSION } from '../version.js';

// Create and configure the MCP server
export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'threadlinking',
      version: VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: `threadlinking preserves AI conversation context across sessions.

Key concepts:
- **Threads**: Named containers for context (use project names, not task names)
- **Snippets**: Context excerpts explaining decisions
- **File links**: Connect files to their origin stories

Proactively save context when:
- Creating new files from conversation decisions
- Making architectural choices
- User asks to "remember why" something was done`,
    }
  );

  // ============================================
  // FREE TOOLS (always available)
  // ============================================

  // threadlinking_snippet - Add context to a thread
  server.tool(
    'threadlinking_snippet',
    'Add a context snippet to a thread. Auto-creates the thread if needed.',
    {
      thread_id: z.string().describe('Thread name (e.g., "myproject")'),
      content: z.string().describe('The context to save (the "why")'),
      tags: z.string().optional().describe('Comma-separated tags (e.g., "auth,decision")'),
      source: z.string().optional().describe('Source identifier (defaults to claude-code)'),
    },
    async (args) => {
      const tags = args.tags?.split(',').map((t) => t.trim()).filter((t) => t);
      const result = await addSnippet({
        threadId: args.thread_id,
        content: args.content,
        tags,
        source: args.source || 'claude-code',
      });

      return {
        content: [
          {
            type: 'text',
            text: result.success
              ? `${result.message}\n\nSnippet saved to thread "${args.thread_id}".`
              : `Error: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );

  // threadlinking_create - Create a new empty thread
  server.tool(
    'threadlinking_create',
    'Create a new empty thread. Use this to set up a thread before adding snippets or files.',
    {
      thread_id: z.string().describe('Thread name (e.g., "myproject")'),
      summary: z.string().optional().describe('Thread description'),
      chat_url: z.string().optional().describe('Associated chat URL'),
    },
    async (args) => {
      const result = createThread({
        threadId: args.thread_id,
        summary: args.summary,
        chatUrl: args.chat_url,
      });

      return {
        content: [
          {
            type: 'text',
            text: result.success
              ? `${result.message}\n\nThread "${args.thread_id}" is ready for snippets and file attachments.`
              : `Error: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );

  // threadlinking_attach - Link a file to a thread
  server.tool(
    'threadlinking_attach',
    'Link a file to a thread. The file will be associated with the thread\'s context.',
    {
      thread_id: z.string().describe('Thread name'),
      file_path: z.string().describe('Path to the file to attach'),
    },
    async (args) => {
      const result = attachFile({
        threadId: args.thread_id,
        filePath: args.file_path,
      });

      return {
        content: [
          {
            type: 'text',
            text: result.success ? result.message : `Error: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );

  // threadlinking_detach - Unlink a file from a thread
  server.tool(
    'threadlinking_detach',
    'Remove a file link from a thread.',
    {
      thread_id: z.string().describe('Thread name'),
      file_path: z.string().describe('Path to the file to detach'),
    },
    async (args) => {
      const result = detachFile({
        threadId: args.thread_id,
        filePath: args.file_path,
      });

      return {
        content: [
          {
            type: 'text',
            text: result.success ? result.message : `Error: ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );

  // threadlinking_explain - Get context for a file
  server.tool(
    'threadlinking_explain',
    'Show why a file exists - its origin story and the decisions that led to it.',
    {
      file_path: z.string().describe('Path to the file to explain'),
    },
    async (args) => {
      const result = explainFile(args.file_path);

      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Error: ${result.message}` }],
          isError: true,
        };
      }

      const { threads } = result.data!;

      if (threads.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No context found for this file.\n\nTip: Use threadlinking_snippet to save context, then threadlinking_attach to link the file.`,
            },
          ],
        };
      }

      // Format the context
      const parts: string[] = [];
      threads.forEach((t) => {
        parts.push(`## Thread: ${t.thread_id}`);
        parts.push(`*${t.summary}*`);
        parts.push('');

        if (t.snippets.length > 0) {
          parts.push('### Context:');
          t.snippets.forEach((s, i) => {
            const tags = s.tags?.length ? ` [${s.tags.join(', ')}]` : '';
            parts.push(`**[${i + 1}]** ${s.source || 'unknown'}${tags}`);
            parts.push(s.content);
            parts.push('');
          });
        }
      });

      return {
        content: [{ type: 'text', text: parts.join('\n') }],
      };
    }
  );

  // threadlinking_show - View thread details
  server.tool(
    'threadlinking_show',
    'View full details of a thread including all snippets and linked files.',
    {
      thread_id: z.string().describe('Thread name'),
      filter_tag: z.string().optional().describe('Filter snippets by tag'),
    },
    async (args) => {
      const result = showThread(args.thread_id, { filterTag: args.filter_tag });

      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Error: ${result.message}` }],
          isError: true,
        };
      }

      const { threadId, thread } = result.data!;
      const parts: string[] = [];

      parts.push(`# ${threadId}`);
      parts.push(`*${thread.summary || '(no summary)'}*`);
      parts.push('');

      if (thread.snippets?.length) {
        parts.push(`## Snippets (${thread.snippets.length})`);
        thread.snippets.forEach((s, i) => {
          const tags = s.tags?.length ? ` [${s.tags.join(', ')}]` : '';
          parts.push(`### [${i + 1}] ${s.source || 'unknown'}${tags}`);
          parts.push(s.content);
          parts.push('');
        });
      }

      if (thread.linked_files?.length) {
        parts.push(`## Linked Files (${thread.linked_files.length})`);
        thread.linked_files.forEach((f) => {
          parts.push(`- \`${f}\``);
        });
      }

      return {
        content: [{ type: 'text', text: parts.join('\n') }],
      };
    }
  );

  // threadlinking_list - List all threads
  server.tool(
    'threadlinking_list',
    'List all threads and any pending unlinked files.',
    {
      prefix: z.string().optional().describe('Filter threads by prefix'),
      include_pending: z.boolean().optional().describe('Include pending files (default: true)'),
    },
    async (args) => {
      const result = listThreads({
        prefix: args.prefix,
        includePending: args.include_pending ?? true,
      });

      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Error: ${result.message}` }],
          isError: true,
        };
      }

      const { threads, pending } = result.data!;
      const parts: string[] = [];

      if (threads.length === 0) {
        parts.push('No threads yet.');
        parts.push('Create one with: threadlinking_snippet');
      } else {
        parts.push('## Threads');
        threads.forEach((t) => {
          parts.push(`- **${t.id}**: ${t.summary || '(no summary)'}`);
          parts.push(`  ${t.snippetCount} snippet(s), ${t.fileCount} file(s)`);
        });
      }

      if (pending.length > 0) {
        parts.push('');
        parts.push(`## Pending Files (${pending.length})`);
        parts.push('*Files edited but not yet linked to a thread:*');
        pending.slice(0, 10).forEach((f) => {
          parts.push(`- ${f.basename}`);
        });
        if (pending.length > 10) {
          parts.push(`... and ${pending.length - 10} more`);
        }
      }

      return {
        content: [{ type: 'text', text: parts.join('\n') }],
      };
    }
  );

  // threadlinking_search - Search threads by keyword
  server.tool(
    'threadlinking_search',
    'Search threads by keyword.',
    {
      query: z.string().describe('Search query'),
    },
    async (args) => {
      const result = searchThreads(args.query);

      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Error: ${result.message}` }],
          isError: true,
        };
      }

      const { results } = result.data!;

      if (results.length === 0) {
        return {
          content: [{ type: 'text', text: 'No matching threads found.' }],
        };
      }

      const parts: string[] = [`## Search Results for "${args.query}"`];
      results.forEach((r) => {
        parts.push(`- **${r.id}**: ${r.thread.summary || '(no summary)'}`);
        parts.push(`  Matched in: ${r.matchedIn.join(', ')}`);
      });

      return {
        content: [{ type: 'text', text: parts.join('\n') }],
      };
    }
  );

  // threadlinking_status - Check available features
  server.tool(
    'threadlinking_status',
    'Check available features.',
    {},
    async () => {
      const parts: string[] = [];
      parts.push(`## Threadlinking v${VERSION}`);
      parts.push('');
      parts.push('## Available Features');
      parts.push('');
      parts.push('**Core:**');
      parts.push('- snippet, attach, detach, explain, show, list, search, create');
      parts.push('');
      parts.push('**Advanced:**');
      parts.push('- semantic_search (natural language search)');
      parts.push('- analytics (usage insights)');
      parts.push('- export (markdown, JSON, timeline)');

      return {
        content: [{ type: 'text', text: parts.join('\n') }],
      };
    }
  );

  // ============================================
  // ADVANCED TOOLS
  // ============================================

  // threadlinking_semantic_search - Search by meaning
  server.tool(
    'threadlinking_semantic_search',
    'Search threads by semantic similarity.',
    {
      query: z.string().describe('Natural language query'),
      limit: z.number().optional().describe('Max results (default: 10)'),
    },
    async (args) => {
      const result = await semanticSearch(args.query, args.limit);

      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Error: ${result.message}` }],
          isError: true,
        };
      }

      const { results } = result.data!;

      if (results.length === 0) {
        return {
          content: [{ type: 'text', text: 'No semantically similar threads found.' }],
        };
      }

      const parts: string[] = [`## Semantic Search Results for "${args.query}"`];
      for (const r of results) {
        parts.push(`- **${r.id}** (score: ${(r.score * 100).toFixed(0)}%)`);
        parts.push(`  ${r.thread.summary || '(no summary)'}`);
      }

      return {
        content: [{ type: 'text', text: parts.join('\n') }],
      };
    }
  );

  // threadlinking_analytics - Usage analytics
  server.tool(
    'threadlinking_analytics',
    'Get usage analytics and insights.',
    {},
    async () => {
      const result = getAnalytics();

      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Error: ${result.message}` }],
          isError: true,
        };
      }

      const data = result.data!;
      const parts: string[] = [];

      parts.push('## threadlinking Analytics');
      parts.push('');
      parts.push('### Summary');
      parts.push(`- Total threads: ${data.summary.totalThreads}`);
      parts.push(`- Total snippets: ${data.summary.totalSnippets}`);
      parts.push(`- Total linked files: ${data.summary.totalLinkedFiles}`);
      parts.push(`- Avg snippets/thread: ${data.summary.avgSnippetsPerThread}`);
      parts.push(`- Avg files/thread: ${data.summary.avgFilesPerThread}`);
      parts.push('');
      parts.push('### Activity');
      parts.push(`- Threads created (7 days): ${data.activity.threadsCreatedLast7Days}`);
      parts.push(`- Threads created (30 days): ${data.activity.threadsCreatedLast30Days}`);
      if (data.activity.mostActiveThread) {
        parts.push(
          `- Most active: ${data.activity.mostActiveThread.id} (${data.activity.mostActiveThread.snippetCount} snippets)`
        );
      }
      parts.push('');
      parts.push('### Top Tags');
      data.tags.slice(0, 5).forEach((t) => {
        parts.push(`- ${t.tag}: ${t.count}`);
      });

      return {
        content: [{ type: 'text', text: parts.join('\n') }],
      };
    }
  );

  // threadlinking_export - Export threads
  server.tool(
    'threadlinking_export',
    'Export thread(s) in various formats.',
    {
      thread_id: z.string().optional().describe('Thread to export (omit for all)'),
      format: z.enum(['markdown', 'json', 'timeline']).describe('Export format'),
    },
    async (args) => {
      const result = exportThread(args.thread_id || null, args.format);

      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Error: ${result.message}` }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `## Export (${args.format})\n\n\`\`\`${args.format === 'json' ? 'json' : ''}\n${result.data!.content}\n\`\`\``,
          },
        ],
      };
    }
  );

  return server;
}
