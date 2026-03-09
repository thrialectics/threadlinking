// List operation - list all threads and pending files
// Returns result object instead of console.log for MCP compatibility

import { basename } from 'path';
import { loadMetaIndex, loadAllThreads, loadPending, updatePending } from '../storage.js';
import { isIgnored } from '../ignore.js';
import type { OperationResult, ListResult, ListOptions } from '../types.js';

export function listThreads(options?: ListOptions): OperationResult<ListResult> {
  try {
    // Use meta index for thread listing (fast - reads one small file)
    const meta = loadMetaIndex();

    const now = new Date();

    // Filter threads
    const entries = Object.entries(meta.threads).filter(([id, threadMeta]) => {
      // Filter by prefix
      if (options?.prefix && !id.startsWith(options.prefix)) {
        return false;
      }

      // Filter by age
      if (options?.since !== undefined) {
        const ts = threadMeta.date_modified || threadMeta.date_created;
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

    // Format thread data using meta index counts
    // Counts are available in meta since v3.0.2; fall back to 0 for older entries
    const threads = entries.map(([id, threadMeta]) => ({
      id,
      summary: threadMeta.summary || '',
      snippetCount: threadMeta.snippetCount ?? 0,
      fileCount: threadMeta.fileCount ?? 0,
      dateModified: threadMeta.date_modified || threadMeta.date_created,
    }));

    // Get pending files
    let pending: ListResult['pending'] = [];

    if (options?.includePending !== false) {
      const pendingState = loadPending();

      // Filter out files already linked to any thread
      // This still requires loading all threads — but only when pending files exist
      const allLinkedFiles = pendingState.tracked.length > 0
        ? new Set(Object.values(loadAllThreads()).flatMap((t) => t.linked_files || []))
        : new Set<string>();

      const untracked = pendingState.tracked
        .filter((f) => !allLinkedFiles.has(f.path))
        .filter((f) => !isIgnored(f.path));

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
    updatePending(() => ({ tracked: [] }));
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
