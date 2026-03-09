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

    // Add relatedId to threadId's related[]
    let alreadyRelated = false;

    updateThread(validatedId, (thread) => {
      const related = thread.related || [];
      if (related.includes(validatedRelatedId)) {
        alreadyRelated = true;
        return thread;
      }
      related.push(validatedRelatedId);
      thread.related = related;
      thread.date_modified = new Date().toISOString();
      return thread;
    });

    // Add threadId to relatedId's related[] (bidirectional)
    if (!alreadyRelated) {
      updateThread(validatedRelatedId, (thread) => {
        const related = thread.related || [];
        if (!related.includes(validatedId)) {
          related.push(validatedId);
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

    // Check if they are actually related
    let wasRelated = false;

    updateThread(validatedId, (thread) => {
      const related = thread.related || [];
      if (related.includes(validatedRelatedId)) {
        wasRelated = true;
        thread.related = related.filter((r) => r !== validatedRelatedId);
        thread.date_modified = new Date().toISOString();
      }
      return thread;
    });

    // Remove from the other side too
    updateThread(validatedRelatedId, (thread) => {
      const related = thread.related || [];
      if (related.includes(validatedId)) {
        thread.related = related.filter((r) => r !== validatedId);
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
