// Show operation - display thread details
// Returns result object instead of console.log for MCP compatibility

import { loadThread } from '../storage.js';
import { validateTag } from '../utils.js';
import type { OperationResult, ShowResult, ShowOptions, Thread } from '../types.js';

export function showThread(threadId: string, options?: ShowOptions): OperationResult<ShowResult> {
  try {
    const validatedId = validateTag(threadId);

    // Load single thread (fast - no need to read all threads)
    const thread = loadThread(validatedId);

    if (!thread) {
      return {
        success: false,
        message: `Thread ID '${validatedId}' not found.`,
        error: 'THREAD_NOT_FOUND',
      };
    }

    const result = { ...thread };

    // Filter snippets by tag if specified
    if (options?.filterTag) {
      const filterTag = options.filterTag.toLowerCase();
      result.snippets = (result.snippets || []).filter((s) =>
        s.tags?.some((t) => t.toLowerCase() === filterTag)
      );
    }

    return {
      success: true,
      message: `Thread '${validatedId}' retrieved.`,
      data: {
        threadId: validatedId,
        thread: result,
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
    const validatedId = validateTag(threadId);
    return loadThread(validatedId);
  } catch {
    return null;
  }
}
