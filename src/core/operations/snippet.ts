// Snippet operation - add context to a thread
// Returns result object instead of console.log for MCP compatibility

import { loadIndex, saveIndex } from '../storage.js';
import {
  validateTag,
  validateUrl,
  sanitizeString,
  detectSource,
  MAX_SNIPPET_LENGTH,
  MAX_SUMMARY_LENGTH,
} from '../utils.js';
import type { OperationResult, SnippetResult, SnippetInput, Snippet } from '../types.js';
import { indexSnippet } from './semantic.js';

export async function addSnippet(input: SnippetInput): Promise<OperationResult<SnippetResult>> {
  try {
    const index = loadIndex();
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

    // Auto-create thread if needed
    let createdNew = false;
    if (!index[validatedId]) {
      let summary: string;
      if (input.summary) {
        summary = sanitizeString(input.summary, MAX_SUMMARY_LENGTH);
      } else {
        // Use first 80 chars of snippet as summary
        const firstLine = snippetContent.split('\n')[0].slice(0, 80);
        summary = firstLine.length < 10 ? snippetContent.slice(0, 80) : firstLine;
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

    const snippetCount = index[validatedId].snippets.length;
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
