// Explain operation - show context for a file
// Returns result object instead of console.log for MCP compatibility

import { loadIndex } from '../storage.js';
import { resolvePath } from '../utils.js';
import type { OperationResult, ExplainResult } from '../types.js';

export function explainFile(filePath: string): OperationResult<ExplainResult> {
  try {
    const index = loadIndex();
    const resolvedPath = resolvePath(filePath);

    // Find all threads that link to this file
    const hits = Object.entries(index)
      .filter(([_, thread]) => thread.linked_files?.includes(resolvedPath))
      .map(([id, thread]) => ({
        thread_id: id,
        summary: thread.summary,
        snippets: thread.snippets || [],
        date_created: thread.date_created,
        date_modified: thread.date_modified,
        chat_url: thread.chat_url,
      }));

    if (hits.length === 0) {
      return {
        success: true,
        message: 'No ThreadLink context for that file.',
        data: {
          filePath: resolvedPath,
          threads: [],
        },
      };
    }

    return {
      success: true,
      message: `Found ${hits.length} thread${hits.length > 1 ? 's' : ''} for this file.`,
      data: {
        filePath: resolvedPath,
        threads: hits,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: 'EXPLAIN_ERROR',
    };
  }
}
