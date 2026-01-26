// List operation - list all threads and pending files
// Returns result object instead of console.log for MCP compatibility

import { basename } from 'path';
import { loadIndex, loadPending, savePending } from '../storage.js';
import type { OperationResult, ListResult, ListOptions } from '../types.js';

export function listThreads(options?: ListOptions): OperationResult<ListResult> {
  try {
    const index = loadIndex();
    const now = new Date();

    // Filter threads
    const entries = Object.entries(index).filter(([id, thread]) => {
      // Filter by prefix
      if (options?.prefix && !id.startsWith(options.prefix)) {
        return false;
      }

      // Filter by age
      if (options?.since !== undefined) {
        const ts = thread.date_modified || thread.date_created;
        if (ts) {
          const date = new Date(ts);
          const daysOld = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
          if (daysOld > options.since) {
            return false;
          }
        }
      }

      return true;
    });

    // Format thread data
    const threads = entries.map(([id, thread]) => ({
      id,
      summary: thread.summary || '',
      snippetCount: (thread.snippets || []).length,
      fileCount: (thread.linked_files || []).length,
      dateModified: thread.date_modified || thread.date_created,
    }));

    // Get pending files
    let pending: ListResult['pending'] = [];

    if (options?.includePending !== false) {
      const pendingState = loadPending();

      // Filter out files already linked to any thread
      const allLinkedFiles = new Set(Object.values(index).flatMap((t) => t.linked_files || []));

      const untracked = pendingState.tracked.filter((f) => !allLinkedFiles.has(f.path));

      // Sort by last_modified descending
      untracked.sort(
        (a, b) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime()
      );

      pending = untracked.map((f) => ({
        path: f.path,
        basename: basename(f.path),
        count: f.count,
        lastModified: f.last_modified,
      }));
    }

    const message =
      threads.length === 0
        ? 'No threads yet.'
        : `Found ${threads.length} thread${threads.length > 1 ? 's' : ''}.`;

    return {
      success: true,
      message,
      data: {
        threads,
        pending,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: 'LIST_ERROR',
    };
  }
}

export function clearPending(): OperationResult {
  try {
    savePending({ tracked: [] });
    return {
      success: true,
      message: 'Pending files cleared.',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: 'CLEAR_PENDING_ERROR',
    };
  }
}
