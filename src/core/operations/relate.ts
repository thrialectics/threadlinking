// Relate operation - link two threads as related
// Relationships are bidirectional: relating A to B also relates B to A

import type { OperationResult } from '../types.js';
import { loadMetaIndex, updateThread } from '../storage.js';
import { validateTag } from '../utils.js';

export interface RelateResult {
  threadId: string;
  relatedTo: string;
  alreadyRelated: boolean;
}

export function relateThreads(threadId: string, relatedId: string): OperationResult<RelateResult> {
  try {
    const validatedId = validateTag(threadId);
    const validatedRelatedId = validateTag(relatedId);

    // Can't relate a thread to itself
    if (validatedId === validatedRelatedId) {
      return {
        success: false,
        message: 'Cannot relate a thread to itself.',
        error: 'SELF_RELATE',
      };
    }

    // Check both threads exist
    const meta = loadMetaIndex();
    if (!meta.threads[validatedId]) {
      return {
        success: false,
        message: `Thread '${validatedId}' not found.`,
        error: 'THREAD_NOT_FOUND',
      };
    }
    if (!meta.threads[validatedRelatedId]) {
      return {
        success: false,
        message: `Thread '${validatedRelatedId}' not found.`,
        error: 'THREAD_NOT_FOUND',
      };
    }

    // Deterministic lock ordering: always update alphabetically-first thread first.
    // Prevents deadlock if concurrent calls do relate(A,B) and relate(B,A).
    const [firstId, secondId] = [validatedId, validatedRelatedId].sort();

    let alreadyRelated = false;

    updateThread(firstId, (thread) => {
      const related = thread.related || [];
      const otherId = firstId === validatedId ? validatedRelatedId : validatedId;
      if (related.includes(otherId)) {
        alreadyRelated = true;
        return thread;
      }
      related.push(otherId);
      thread.related = related;
      thread.date_modified = new Date().toISOString();
      return thread;
    });

    // Add to the other side (bidirectional)
    if (!alreadyRelated) {
      updateThread(secondId, (thread) => {
        const related = thread.related || [];
        const otherId = secondId === validatedRelatedId ? validatedId : validatedRelatedId;
        if (!related.includes(otherId)) {
          related.push(otherId);
          thread.related = related;
          thread.date_modified = new Date().toISOString();
        }
        return thread;
      });
    }

    if (alreadyRelated) {
      return {
        success: true,
        message: `Threads '${validatedId}' and '${validatedRelatedId}' are already related.`,
        data: {
          threadId: validatedId,
          relatedTo: validatedRelatedId,
          alreadyRelated: true,
        },
      };
    }

    return {
      success: true,
      message: `Threads '${validatedId}' and '${validatedRelatedId}' are now related.`,
      data: {
        threadId: validatedId,
        relatedTo: validatedRelatedId,
        alreadyRelated: false,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: 'RELATE_ERROR',
    };
  }
}

export function unrelateThreads(threadId: string, relatedId: string): OperationResult<RelateResult> {
  try {
    const validatedId = validateTag(threadId);
    const validatedRelatedId = validateTag(relatedId);

    // Check both threads exist
    const meta = loadMetaIndex();
    if (!meta.threads[validatedId]) {
      return {
        success: false,
        message: `Thread '${validatedId}' not found.`,
        error: 'THREAD_NOT_FOUND',
      };
    }
    if (!meta.threads[validatedRelatedId]) {
      return {
        success: false,
        message: `Thread '${validatedRelatedId}' not found.`,
        error: 'THREAD_NOT_FOUND',
      };
    }

    // Deterministic lock ordering: alphabetically-first thread first
    const [firstId, secondId] = [validatedId, validatedRelatedId].sort();

    let wasRelated = false;

    updateThread(firstId, (thread) => {
      const related = thread.related || [];
      const otherId = firstId === validatedId ? validatedRelatedId : validatedId;
      if (related.includes(otherId)) {
        wasRelated = true;
        thread.related = related.filter((r) => r !== otherId);
        thread.date_modified = new Date().toISOString();
      }
      return thread;
    });

    // Remove from the other side too
    updateThread(secondId, (thread) => {
      const related = thread.related || [];
      const otherId = secondId === validatedRelatedId ? validatedId : validatedRelatedId;
      if (related.includes(otherId)) {
        thread.related = related.filter((r) => r !== otherId);
        thread.date_modified = new Date().toISOString();
      }
      return thread;
    });

    if (!wasRelated) {
      return {
        success: true,
        message: `Threads '${validatedId}' and '${validatedRelatedId}' are not related.`,
        data: {
          threadId: validatedId,
          relatedTo: validatedRelatedId,
          alreadyRelated: false,
        },
      };
    }

    return {
      success: true,
      message: `Threads '${validatedId}' and '${validatedRelatedId}' are no longer related.`,
      data: {
        threadId: validatedId,
        relatedTo: validatedRelatedId,
        alreadyRelated: false,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: 'UNRELATE_ERROR',
    };
  }
}
