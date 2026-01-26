// Search operation - search threads by keyword
// Returns result object instead of console.log for MCP compatibility

import { loadIndex } from '../storage.js';
import { sanitizeString } from '../utils.js';
import type { OperationResult, SearchResult, Thread } from '../types.js';

export function searchThreads(query: string): OperationResult<SearchResult> {
  try {
    const index = loadIndex();
    const searchQuery = sanitizeString(query, 100).toLowerCase();

    if (!searchQuery) {
      return {
        success: false,
        message: 'Search query cannot be empty',
        error: 'EMPTY_QUERY',
      };
    }

    const results: SearchResult['results'] = [];

    Object.entries(index).forEach(([id, thread]) => {
      const matchedIn: ('id' | 'summary' | 'snippets')[] = [];
      const summary = (thread.summary || '').toLowerCase();
      const idLower = id.toLowerCase();

      // Check ID
      if (idLower.includes(searchQuery)) {
        matchedIn.push('id');
      }

      // Check summary
      if (summary.includes(searchQuery)) {
        matchedIn.push('summary');
      }

      // Check snippets
      const snippets = thread.snippets || [];
      const snippetMatch = snippets.some((s) =>
        (s.content || '').toLowerCase().includes(searchQuery)
      );
      if (snippetMatch) {
        matchedIn.push('snippets');
      }

      if (matchedIn.length > 0) {
        results.push({
          id,
          thread,
          matchedIn,
        });
      }
    });

    const message =
      results.length === 0
        ? 'No matching threads found.'
        : `Found ${results.length} matching thread${results.length > 1 ? 's' : ''}.`;

    return {
      success: true,
      message,
      data: {
        query: searchQuery,
        results,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: 'SEARCH_ERROR',
    };
  }
}
