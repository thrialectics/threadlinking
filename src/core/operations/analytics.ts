// Analytics operation
// Provides insights about thread usage

import { loadIndex } from '../storage.js';
import type { OperationResult } from '../types.js';

export interface AnalyticsResult {
  summary: {
    totalThreads: number;
    totalSnippets: number;
    totalLinkedFiles: number;
    avgSnippetsPerThread: number;
    avgFilesPerThread: number;
  };
  activity: {
    threadsCreatedLast7Days: number;
    threadsCreatedLast30Days: number;
    mostActiveThread: { id: string; snippetCount: number } | null;
  };
  sources: Record<string, number>;
  tags: Array<{ tag: string; count: number }>;
  oldestThread: { id: string; date: string } | null;
  newestThread: { id: string; date: string } | null;
}

/**
 * Get analytics about thread usage
 */
export function getAnalytics(): OperationResult<AnalyticsResult> {
  try {
    const index = loadIndex();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let totalSnippets = 0;
    let totalLinkedFiles = 0;
    let threadsCreatedLast7Days = 0;
    let threadsCreatedLast30Days = 0;
    const sources: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};
    let mostActiveThread: { id: string; snippetCount: number } | null = null;
    let oldestThread: { id: string; date: string } | null = null;
    let newestThread: { id: string; date: string } | null = null;

    const threads = Object.entries(index);

    threads.forEach(([id, thread]) => {
      const snippets = thread.snippets || [];
      const files = thread.linked_files || [];

      totalSnippets += snippets.length;
      totalLinkedFiles += files.length;

      // Track most active thread
      if (!mostActiveThread || snippets.length > mostActiveThread.snippetCount) {
        mostActiveThread = { id, snippetCount: snippets.length };
      }

      // Track oldest/newest
      const created = thread.date_created;
      if (created) {
        const createdDate = new Date(created);

        if (!oldestThread || createdDate < new Date(oldestThread.date)) {
          oldestThread = { id, date: created };
        }

        if (!newestThread || createdDate > new Date(newestThread.date)) {
          newestThread = { id, date: created };
        }

        // Count recent activity
        if (createdDate >= sevenDaysAgo) {
          threadsCreatedLast7Days++;
        }
        if (createdDate >= thirtyDaysAgo) {
          threadsCreatedLast30Days++;
        }
      }

      // Count sources and tags
      snippets.forEach((snippet) => {
        const source = snippet.source || 'unknown';
        sources[source] = (sources[source] || 0) + 1;

        (snippet.tags || []).forEach((tag) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });
    });

    const totalThreads = threads.length;

    // Sort tags by count
    const tags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const result: AnalyticsResult = {
      summary: {
        totalThreads,
        totalSnippets,
        totalLinkedFiles,
        avgSnippetsPerThread: totalThreads > 0 ? Math.round((totalSnippets / totalThreads) * 10) / 10 : 0,
        avgFilesPerThread: totalThreads > 0 ? Math.round((totalLinkedFiles / totalThreads) * 10) / 10 : 0,
      },
      activity: {
        threadsCreatedLast7Days,
        threadsCreatedLast30Days,
        mostActiveThread,
      },
      sources,
      tags,
      oldestThread,
      newestThread,
    };

    return {
      success: true,
      message: 'Analytics generated.',
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: 'ANALYTICS_ERROR',
    };
  }
}
