// Export operation
// Export threads in various formats

import { loadIndex } from '../storage.js';
import { formatDate } from '../utils.js';
import type { OperationResult, Thread } from '../types.js';

export type ExportFormat = 'markdown' | 'json' | 'timeline';

export interface ExportResult {
  format: ExportFormat;
  threadId?: string;
  content: string;
}

/**
 * Export a thread or all threads
 */
export function exportThread(
  threadId: string | null,
  format: ExportFormat
): OperationResult<ExportResult> {
  try {
    const index = loadIndex();

    // If threadId specified, export just that thread
    if (threadId) {
      if (!index[threadId]) {
        return {
          success: false,
          message: `Thread '${threadId}' not found.`,
          error: 'THREAD_NOT_FOUND',
        };
      }

      const content = formatThread(threadId, index[threadId], format);

      return {
        success: true,
        message: `Exported thread '${threadId}' as ${format}.`,
        data: {
          format,
          threadId,
          content,
        },
      };
    }

    // Export all threads
    const content = formatAllThreads(index, format);

    return {
      success: true,
      message: `Exported all threads as ${format}.`,
      data: {
        format,
        content,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: 'EXPORT_ERROR',
    };
  }
}

function formatThread(id: string, thread: Thread, format: ExportFormat): string {
  switch (format) {
    case 'markdown':
      return formatThreadMarkdown(id, thread);
    case 'json':
      return JSON.stringify({ [id]: thread }, null, 2);
    case 'timeline':
      return formatThreadTimeline(id, thread);
    default:
      return JSON.stringify({ [id]: thread }, null, 2);
  }
}

function formatAllThreads(index: Record<string, Thread>, format: ExportFormat): string {
  switch (format) {
    case 'markdown':
      return Object.entries(index)
        .map(([id, thread]) => formatThreadMarkdown(id, thread))
        .join('\n\n---\n\n');
    case 'json':
      return JSON.stringify(index, null, 2);
    case 'timeline':
      return formatAllTimeline(index);
    default:
      return JSON.stringify(index, null, 2);
  }
}

function formatThreadMarkdown(id: string, thread: Thread): string {
  const lines: string[] = [];

  lines.push(`# ${id}`);
  lines.push('');
  lines.push(`**Summary:** ${thread.summary || '(no summary)'}`);
  lines.push('');
  lines.push(`**Created:** ${formatDate(thread.date_created || '')}`);

  if (thread.date_modified && thread.date_modified !== thread.date_created) {
    lines.push(`**Modified:** ${formatDate(thread.date_modified)}`);
  }

  if (thread.chat_url) {
    lines.push(`**URL:** ${thread.chat_url}`);
  }

  // Snippets
  const snippets = thread.snippets || [];
  if (snippets.length > 0) {
    lines.push('');
    lines.push('## Context');
    lines.push('');

    snippets.forEach((s, i) => {
      const tags = s.tags?.length ? ` [${s.tags.join(', ')}]` : '';
      lines.push(`### [${i + 1}] ${s.source || 'unknown'} @ ${formatDate(s.timestamp || '')}${tags}`);
      lines.push('');
      lines.push(s.content || '');
      lines.push('');

      if (s.url) {
        lines.push(`*Source: ${s.url}*`);
        lines.push('');
      }
    });
  }

  // Linked files
  const files = thread.linked_files || [];
  if (files.length > 0) {
    lines.push('## Linked Files');
    lines.push('');
    files.forEach((f) => {
      lines.push(`- \`${f}\``);
    });
  }

  return lines.join('\n');
}

function formatThreadTimeline(id: string, thread: Thread): string {
  const events: Array<{ date: string; type: string; content: string }> = [];

  // Thread creation
  if (thread.date_created) {
    events.push({
      date: thread.date_created,
      type: 'created',
      content: `Thread "${id}" created: ${thread.summary || '(no summary)'}`,
    });
  }

  // Snippets
  (thread.snippets || []).forEach((s, i) => {
    if (s.timestamp) {
      const preview = (s.content || '').slice(0, 100);
      events.push({
        date: s.timestamp,
        type: 'snippet',
        content: `[${s.source || 'unknown'}] ${preview}${(s.content || '').length > 100 ? '...' : ''}`,
      });
    }
  });

  // Sort by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return events.map((e) => `${formatDate(e.date)} | ${e.type.padEnd(8)} | ${e.content}`).join('\n');
}

function formatAllTimeline(index: Record<string, Thread>): string {
  const events: Array<{ date: string; threadId: string; type: string; content: string }> = [];

  Object.entries(index).forEach(([id, thread]) => {
    // Thread creation
    if (thread.date_created) {
      events.push({
        date: thread.date_created,
        threadId: id,
        type: 'created',
        content: `Thread "${id}" created`,
      });
    }

    // Snippets
    (thread.snippets || []).forEach((s) => {
      if (s.timestamp) {
        const preview = (s.content || '').slice(0, 60);
        events.push({
          date: s.timestamp,
          threadId: id,
          type: 'snippet',
          content: preview + ((s.content || '').length > 60 ? '...' : ''),
        });
      }
    });
  });

  // Sort by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return events
    .map((e) => `${formatDate(e.date)} | ${e.threadId.padEnd(20)} | ${e.type.padEnd(8)} | ${e.content}`)
    .join('\n');
}
