/**
 * Vectra index wrapper for threadlinking semantic search.
 * Stores embeddings of thread summaries and snippets.
 */

import { LocalIndex } from 'vectra';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Base type that Vectra requires (no undefined)
interface BaseSemanticMetadata {
  threadId: string;
  type: 'summary' | 'snippet';
  snippetIndex: number; // -1 for summaries
  text: string; // Preview (first 200 chars)
  timestamp: string;
  [key: string]: string | number;
}

// Public interface for convenience (allows optional snippetIndex)
export interface SemanticMetadata {
  threadId: string;
  type: 'summary' | 'snippet';
  snippetIndex?: number;
  text: string;
  timestamp: string;
}

export interface SemanticSearchResult {
  score: number;
  metadata: SemanticMetadata;
}

export interface IndexStats {
  totalItems: number;
  threads: number;
  summaries: number;
  snippets: number;
  lastUpdated?: string;
}

const INDEX_DIR = path.join(os.homedir(), '.threadlinking', 'semantic-index');
const TIMESTAMP_FILE = path.join(INDEX_DIR, '.last-updated');

// Convert public metadata to base (for storage)
function toBaseMetadata(meta: SemanticMetadata): BaseSemanticMetadata {
  return {
    ...meta,
    snippetIndex: meta.snippetIndex ?? -1,
  };
}

// Convert base metadata to public (from storage)
function fromBaseMetadata(meta: BaseSemanticMetadata): SemanticMetadata {
  const result: SemanticMetadata = {
    threadId: meta.threadId,
    type: meta.type,
    text: meta.text,
    timestamp: meta.timestamp,
  };
  if (meta.snippetIndex >= 0) {
    result.snippetIndex = meta.snippetIndex;
  }
  return result;
}

export class SemanticIndex {
  private index: LocalIndex<BaseSemanticMetadata>;
  private indexPath: string;

  constructor(indexPath: string = INDEX_DIR) {
    this.indexPath = indexPath;
    this.index = new LocalIndex<BaseSemanticMetadata>(indexPath);
  }

  /**
   * Initialize the index (create if needed)
   */
  async init(): Promise<void> {
    // Ensure directory exists
    fs.mkdirSync(this.indexPath, { recursive: true });

    if (!await this.index.isIndexCreated()) {
      await this.index.createIndex();
    }
  }

  /**
   * Check if the index exists
   */
  async exists(): Promise<boolean> {
    return await this.index.isIndexCreated();
  }

  /**
   * Add items to the index
   */
  async addItems(
    items: Array<{ vector: number[]; metadata: SemanticMetadata }>
  ): Promise<void> {
    if (items.length === 0) return;

    await this.index.beginUpdate();

    for (const item of items) {
      await this.index.insertItem({
        vector: item.vector,
        metadata: toBaseMetadata(item.metadata),
      });
    }

    await this.index.endUpdate();
    this.updateTimestamp();
  }

  /**
   * Add a single item to the index
   */
  async addItem(vector: number[], metadata: SemanticMetadata): Promise<void> {
    await this.index.beginUpdate();
    await this.index.insertItem({ vector, metadata: toBaseMetadata(metadata) });
    await this.index.endUpdate();
    this.updateTimestamp();
  }

  /**
   * Delete all items for a specific thread
   */
  async deleteThread(threadId: string): Promise<number> {
    const items = await this.index.listItemsByMetadata({
      threadId: { $eq: threadId },
    });

    if (items.length === 0) return 0;

    await this.index.beginUpdate();
    for (const item of items) {
      await this.index.deleteItem(item.id);
    }
    await this.index.endUpdate();
    this.updateTimestamp();

    return items.length;
  }

  /**
   * Search the index
   */
  async search(queryVector: number[], limit = 10): Promise<SemanticSearchResult[]> {
    // Vectra queryItems signature: (vector, query, topK, filter?, isBm25?)
    // We pass empty query since we're doing pure vector search
    const results = await this.index.queryItems(queryVector, '', limit);

    return results.map((result) => ({
      score: result.score,
      metadata: fromBaseMetadata(result.item.metadata),
    }));
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<IndexStats> {
    const items = await this.index.listItems();

    const threads = new Set<string>();
    let summaries = 0;
    let snippets = 0;

    for (const item of items) {
      threads.add(item.metadata.threadId);
      if (item.metadata.type === 'summary') {
        summaries++;
      } else {
        snippets++;
      }
    }

    return {
      totalItems: items.length,
      threads: threads.size,
      summaries,
      snippets,
      lastUpdated: this.getLastUpdated(),
    };
  }

  /**
   * Clear the entire index
   */
  async clear(): Promise<void> {
    const items = await this.index.listItems();

    if (items.length === 0) return;

    await this.index.beginUpdate();
    for (const item of items) {
      await this.index.deleteItem(item.id);
    }
    await this.index.endUpdate();
    this.updateTimestamp();
  }

  /**
   * Get the last update timestamp
   */
  getLastUpdated(): string | undefined {
    try {
      if (fs.existsSync(TIMESTAMP_FILE)) {
        return fs.readFileSync(TIMESTAMP_FILE, 'utf-8').trim();
      }
    } catch {
      // Ignore errors
    }
    return undefined;
  }

  /**
   * Check if the index is stale compared to thread_index.json
   */
  isStale(threadIndexMtime: Date): boolean {
    const lastUpdated = this.getLastUpdated();
    if (!lastUpdated) return true;

    const indexDate = new Date(lastUpdated);
    return threadIndexMtime > indexDate;
  }

  private updateTimestamp(): void {
    try {
      fs.writeFileSync(TIMESTAMP_FILE, new Date().toISOString());
    } catch {
      // Ignore errors
    }
  }
}

// Singleton instance
let defaultIndex: SemanticIndex | null = null;

export async function getSemanticIndex(): Promise<SemanticIndex> {
  if (!defaultIndex) {
    defaultIndex = new SemanticIndex();
    await defaultIndex.init();
  }
  return defaultIndex;
}

export function getIndexPath(): string {
  return INDEX_DIR;
}
