// Delete operation - permanently remove a thread and clean up references
// Returns result object for MCP compatibility

import { loadMetaIndex, loadThread, deleteThreadFile, updateThread } from '../storage.js';
import { validateTag } from '../utils.js';
import { getSemanticIndex } from '../../embeddings/index.js';
import type { OperationResult } from '../types.js';

export interface DeleteInput {
  threadId: string;
}

export interface DeleteResult {
  threadId: string;
  snippetsRemoved: number;
  filesUnlinked: number;
  semanticEntriesRemoved: number;
  relatedThreadsUpdated: string[];
}

export async function deleteThread(input: DeleteInput): Promise<OperationResult<DeleteResult>> {
  try {
    const validatedId = validateTag(input.threadId);

    // Check thread exists via meta index (fast)
    const meta = loadMetaIndex();
    if (!meta.threads[validatedId]) {
      return {
        success: false,
        message: `Thread '${validatedId}' not found.`,
        error: 'THREAD_NOT_FOUND',
      };
    }

    // Load full thread data so we can report what's being removed
    // and clean up bidirectional related-thread references
    const thread = loadThread(validatedId);
    const snippetsRemoved = thread?.snippets?.length ?? 0;
    const filesUnlinked = thread?.linked_files?.length ?? 0;
    const relatedThreads = thread?.related ?? [];

    // Remove this thread from every related thread's `related` array.
    // Without this, deleting A leaves stale references in B, C, etc.
    const relatedThreadsUpdated: string[] = [];
    for (const relatedId of relatedThreads) {
      try {
        updateThread(relatedId, (relatedThread) => {
          const related = relatedThread.related || [];
          relatedThread.related = related.filter((r) => r !== validatedId);
          relatedThread.date_modified = new Date().toISOString();
          return relatedThread;
        });
        relatedThreadsUpdated.push(relatedId);
      } catch {
        // Related thread may already be gone — not fatal
      }
    }

    // Delete the thread file and remove from meta index
    deleteThreadFile(validatedId);

    // Clean up semantic index embeddings (non-fatal if index doesn't exist)
    let semanticEntriesRemoved = 0;
    try {
      const semanticIndex = await getSemanticIndex();
      semanticEntriesRemoved = await semanticIndex.deleteThread(validatedId);
    } catch {
      // Semantic index may not exist or may not be initialized
    }

    return {
      success: true,
      message: `Thread '${validatedId}' deleted.`,
      data: {
        threadId: validatedId,
        snippetsRemoved,
        filesUnlinked,
        semanticEntriesRemoved,
        relatedThreadsUpdated,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: 'DELETE_ERROR',
    };
  }
}
