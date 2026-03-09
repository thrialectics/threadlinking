// Snippet operation - add context to a thread
// Returns result object instead of console.log for MCP compatibility

import { updateThread, saveThread, loadMetaIndex } from '../storage.js';
import {
  validateTag,
  validateUrl,
  sanitizeString,
  detectSource,
  MAX_SNIPPET_LENGTH,
  MAX_SUMMARY_LENGTH,
} from '../utils.js';
import type { OperationResult, SnippetResult, SnippetInput, Snippet, Thread } from '../types.js';
import { indexSnippet } from './semantic.js';

export async function addSnippet(input: SnippetInput): Promise<OperationResult<SnippetResult>> {
  try {
    const validatedId = validateTag(input.threadId);

    // Validate content
    if (!input.content?.trim()) {
      return {
        success: false,
        message: 'Snippet content cannot be empty',
        error: 'EMPTY_CONTENT',
      };
    }

    // Sanitize content
    const snippetContent = sanitizeString(input.content.trim(), MAX_SNIPPET_LENGTH);

    // Determine source
    const source = input.source || detectSource();

    // Create snippet object
    const snippet: Snippet = {
      content: snippetContent,
      source,
      timestamp: new Date().toISOString(),
    };

    if (input.url) {
      snippet.url = validateUrl(input.url);
    }

    if (input.tags && input.tags.length > 0) {
      snippet.tags = input.tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0);
    }

    // Check if thread exists
    const meta = loadMetaIndex();
    const threadExists = validatedId in meta.threads;

    let createdNew = false;
    let snippetCount = 0;
    let duplicateFound = false;

    if (threadExists) {
      // Update existing thread with per-thread locking
      updateThread(validatedId, (thread: Thread) => {
        if (!thread.snippets) {
          thread.snippets = [];
        }

        // Check last 10 snippets for duplicate content
        const recentSnippets = thread.snippets.slice(-10);
        const trimmedContent = snippet.content.trim();
        if (recentSnippets.some((s) => s.content.trim() === trimmedContent)) {
          duplicateFound = true;
          snippetCount = thread.snippets.length;
          return thread; // Return unmodified
        }

        thread.snippets.push(snippet);
        thread.date_modified = new Date().toISOString();
        snippetCount = thread.snippets.length;
        return thread;
      });

      if (duplicateFound) {
        return {
          success: true,
          message: 'Duplicate snippet detected — this content matches a recent snippet. Not added.',
          data: {
            threadId: validatedId,
            snippetIndex: -1,
            created: false,
            snippetCount,
          },
        };
      }
    } else {
      // Auto-create thread
      let summary: string;
      if (input.summary) {
        summary = sanitizeString(input.summary, MAX_SUMMARY_LENGTH);
      } else {
        const firstLine = snippetContent.split('\n')[0].slice(0, 80);
        summary = firstLine.length < 10 ? snippetContent.slice(0, 80) : firstLine;
        if (snippetContent.length > 80) summary += '...';
      }

      const newThread: Thread = {
        summary,
        snippets: [snippet],
        linked_files: [],
        chat_url: '',
        date_created: new Date().toISOString(),
      };

      saveThread(validatedId, newThread);
      createdNew = true;
      snippetCount = 1;
    }

    const snippetIndex = snippetCount - 1;

    // Auto-update semantic index (best-effort, non-blocking)
    indexSnippet(
      validatedId,
      snippetIndex,
      snippetContent,
      snippet.timestamp
    ).catch(() => {
      // Silently ignore errors - user can run reindex if needed
    });

    const message = createdNew
      ? `Created thread '${validatedId}' with snippet`
      : `Added snippet to '${validatedId}' (${snippetCount} snippet${snippetCount > 1 ? 's' : ''} total)`;

    return {
      success: true,
      message,
      data: {
        threadId: validatedId,
        snippetIndex,
        created: createdNew,
        snippetCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: 'SNIPPET_ERROR',
    };
  }
}
