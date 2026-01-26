// Semantic search operation
// Uses all-MiniLM-L6-v2 embeddings via @xenova/transformers (pure Node.js)

import { loadIndex, getIndexPath } from '../storage.js';
import type { OperationResult, Thread } from '../types.js';
import { getEmbedder, stopEmbedder } from '../../embeddings/embedder.js';
import {
  getSemanticIndex,
  SemanticIndex,
  SemanticMetadata,
} from '../../embeddings/index.js';
import fs from 'fs';

export interface SemanticSearchResult {
  query: string;
  results: Array<{
    id: string;
    thread: Thread;
    score: number;
    matchedSnippets: number[];
  }>;
  staleWarning?: string;
}

export interface RebuildResult {
  threadsIndexed: number;
  itemsCreated: number;
}

/**
 * Search threads by semantic similarity
 */
export async function semanticSearch(
  query: string,
  limit = 10
): Promise<OperationResult<SemanticSearchResult>> {
  try {
    // Check if semantic index exists
    const semanticIndex = await getSemanticIndex();
    if (!(await semanticIndex.exists())) {
      return {
        success: false,
        message:
          'Semantic index not found. Run "threadlinking reindex" to build it.',
        error: 'INDEX_NOT_FOUND',
      };
    }

    // Check if index is stale
    let staleWarning: string | undefined;
    const threadIndexPath = getIndexPath();
    if (fs.existsSync(threadIndexPath)) {
      const stats = fs.statSync(threadIndexPath);
      if (semanticIndex.isStale(stats.mtime)) {
        staleWarning =
          'Semantic index may be outdated. Run "threadlinking reindex" for best results.';
      }
    }

    // Get embedder and embed query
    const embedder = await getEmbedder();
    const queryVector = await embedder.embedOne(query);

    // Search the index
    const searchResults = await semanticIndex.search(queryVector, limit * 3);

    // Group results by thread and aggregate scores
    const threadIndex = loadIndex();
    const threadScores = new Map<
      string,
      { score: number; matchedSnippets: number[] }
    >();

    for (const result of searchResults) {
      const threadId = result.metadata.threadId;
      const existing = threadScores.get(threadId) || {
        score: 0,
        matchedSnippets: [],
      };

      // Use max score for the thread
      existing.score = Math.max(existing.score, result.score);

      // Track matched snippets
      if (
        result.metadata.type === 'snippet' &&
        result.metadata.snippetIndex !== undefined
      ) {
        existing.matchedSnippets.push(result.metadata.snippetIndex);
      }

      threadScores.set(threadId, existing);
    }

    // Build final results
    const results: SemanticSearchResult['results'] = [];

    for (const [threadId, data] of threadScores) {
      const thread = threadIndex[threadId];
      if (thread) {
        results.push({
          id: threadId,
          thread,
          score: data.score,
          matchedSnippets: [...new Set(data.matchedSnippets)].sort(
            (a, b) => a - b
          ),
        });
      }
    }

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);
    const limitedResults = results.slice(0, limit);

    return {
      success: true,
      message:
        limitedResults.length === 0
          ? 'No semantically similar threads found.'
          : `Found ${limitedResults.length} similar thread${limitedResults.length > 1 ? 's' : ''}.`,
      data: {
        query,
        results: limitedResults,
        staleWarning,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      message,
      error: 'SEMANTIC_SEARCH_ERROR',
    };
  }
}

/**
 * Rebuild the entire semantic index from thread_index.json
 */
export async function rebuildSemanticIndex(
  onProgress?: (message: string) => void
): Promise<OperationResult<RebuildResult>> {
  try {
    const log = onProgress || (() => {});

    log('Loading threads...');
    const threadIndex = loadIndex();
    const threadIds = Object.keys(threadIndex);

    if (threadIds.length === 0) {
      return {
        success: true,
        message: 'No threads to index.',
        data: { threadsIndexed: 0, itemsCreated: 0 },
      };
    }

    log(`Found ${threadIds.length} threads.`);

    // Start embedder
    log('Starting embedding service...');
    const embedder = await getEmbedder();

    // Clear and reinitialize index
    log('Clearing existing index...');
    const semanticIndex = await getSemanticIndex();
    await semanticIndex.clear();

    // Collect all texts to embed
    const textsToEmbed: Array<{
      text: string;
      metadata: Omit<SemanticMetadata, 'text'>;
    }> = [];

    for (const threadId of threadIds) {
      const thread = threadIndex[threadId];

      // Add summary
      if (thread.summary) {
        textsToEmbed.push({
          text: thread.summary,
          metadata: {
            threadId,
            type: 'summary',
            timestamp: thread.date_modified || thread.date_created,
          },
        });
      }

      // Add snippets
      (thread.snippets || []).forEach((snippet, index) => {
        if (snippet.content) {
          textsToEmbed.push({
            text: snippet.content,
            metadata: {
              threadId,
              type: 'snippet',
              snippetIndex: index,
              timestamp: snippet.timestamp,
            },
          });
        }
      });
    }

    if (textsToEmbed.length === 0) {
      return {
        success: true,
        message: 'No content to index.',
        data: { threadsIndexed: threadIds.length, itemsCreated: 0 },
      };
    }

    log(`Embedding ${textsToEmbed.length} items...`);

    // Generate embeddings in batches
    const texts = textsToEmbed.map((t) => t.text);
    const embeddings = await embedder.embed(texts);

    log('Storing in index...');

    // Add to index
    const items = textsToEmbed.map((item, i) => ({
      vector: embeddings[i],
      metadata: {
        ...item.metadata,
        text: item.text.slice(0, 200), // Preview
      } as SemanticMetadata,
    }));

    await semanticIndex.addItems(items);

    log('Done!');

    return {
      success: true,
      message: `Indexed ${threadIds.length} threads (${items.length} items).`,
      data: {
        threadsIndexed: threadIds.length,
        itemsCreated: items.length,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      message,
      error: 'REBUILD_ERROR',
    };
  }
}

/**
 * Add a single snippet to the semantic index (for auto-update)
 */
export async function indexSnippet(
  threadId: string,
  snippetIndex: number,
  content: string,
  timestamp: string
): Promise<void> {
  try {
    const semanticIndex = await getSemanticIndex();

    // Only update if index exists
    if (!(await semanticIndex.exists())) {
      return;
    }

    const embedder = await getEmbedder();
    const vector = await embedder.embedOne(content);

    await semanticIndex.addItem(vector, {
      threadId,
      type: 'snippet',
      snippetIndex,
      text: content.slice(0, 200),
      timestamp,
    });
  } catch {
    // Silently fail - auto-indexing is best-effort
    // User can run reindex if needed
  }
}

/**
 * Clean up embedder process
 */
export function cleanup(): void {
  stopEmbedder();
}
