// Show operation - display thread details
// Returns result object instead of console.log for MCP compatibility

import { loadIndex } from '../storage.js';
import { validateTag } from '../utils.js';
import type { OperationResult, ShowResult, ShowOptions, Thread } from '../types.js';

export function showThread(threadId: string, options?: ShowOptions): OperationResult<ShowResult> {
  try {
    const index = loadIndex();
    const validatedId = validateTag(threadId);

    if (!index[validatedId]) {
      return {
        success: false,
        message: `Thread ID '${validatedId}' not found.`,
        error: 'THREAD_NOT_FOUND',
      };
    }

    const thread = { ...index[validatedId] };

    // Filter snippets by tag if specified
    if (options?.filterTag) {
      const filterTag = options.filterTag.toLowerCase();
      thread.snippets = (thread.snippets || []).filter((s) =>
        s.tags?.some((t) => t.toLowerCase() === filterTag)
      );
    }

    return {
      success: true,
      message: `Thread '${validatedId}' retrieved.`,
      data: {
        threadId: validatedId,
        thread,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: 'SHOW_ERROR',
    };
  }
}

export function getThread(threadId: string): Thread | null {
  try {
    const index = loadIndex();
    const validatedId = validateTag(threadId);
    return index[validatedId] || null;
  } catch {
    return null;
  }
}
