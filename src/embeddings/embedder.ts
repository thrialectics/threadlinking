/**
 * Embedding service using @xenova/transformers.
 * Runs all-MiniLM-L6-v2 model in pure Node.js via ONNX runtime.
 * No Python dependency required.
 */

import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers';

// Configure cache location (uses ~/.cache/huggingface by default)
// Disable local model check to always use remote/cached
env.allowLocalModels = false;

export interface EmbedderConfig {
  batchSize?: number;
  showProgress?: boolean;
}

export class Embedder {
  private extractor: FeatureExtractionPipeline | null = null;
  private batchSize: number;
  private showProgress: boolean;

  constructor(config: EmbedderConfig = {}) {
    this.batchSize = config.batchSize || 32;
    this.showProgress = config.showProgress ?? false;
  }

  /**
   * Initialize the embedding model.
   * Downloads model on first run (~30MB), cached for subsequent runs.
   */
  async start(): Promise<void> {
    if (this.extractor) {
      return; // Already started
    }

    // Show progress during model download
    if (this.showProgress) {
      console.error('Loading embedding model...');
    }

    this.extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { progress_callback: this.showProgress ? undefined : () => {} }
    );

    if (this.showProgress) {
      console.error('Embedding model ready.');
    }
  }

  /**
   * Generate embeddings for a list of texts.
   * Returns 384-dimensional normalized vectors.
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (!this.extractor) {
      throw new Error('Embedder not started. Call start() first.');
    }

    if (texts.length === 0) {
      return [];
    }

    // Process in batches if needed
    if (texts.length > this.batchSize) {
      const results: number[][] = [];
      for (let i = 0; i < texts.length; i += this.batchSize) {
        const batch = texts.slice(i, i + this.batchSize);
        const batchResults = await this.embedBatch(batch);
        results.push(...batchResults);
      }
      return results;
    }

    return this.embedBatch(texts);
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    const output = await this.extractor!(texts, {
      pooling: 'mean',
      normalize: true,
    });

    return output.tolist();
  }

  /**
   * Generate embedding for a single text (convenience method).
   */
  async embedOne(text: string): Promise<number[]> {
    const results = await this.embed([text]);
    return results[0];
  }

  /**
   * Release resources (model stays cached on disk).
   */
  stop(): void {
    this.extractor = null;
  }

  /**
   * Check if the embedder is ready.
   */
  isReady(): boolean {
    return this.extractor !== null;
  }
}

// Singleton instance for convenience
let defaultEmbedder: Embedder | null = null;

export async function getEmbedder(): Promise<Embedder> {
  if (!defaultEmbedder) {
    defaultEmbedder = new Embedder({ showProgress: true });
    await defaultEmbedder.start();
  }
  return defaultEmbedder;
}

export function stopEmbedder(): void {
  if (defaultEmbedder) {
    defaultEmbedder.stop();
    defaultEmbedder = null;
  }
}
