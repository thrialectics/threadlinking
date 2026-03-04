// Attach operation - link a file to a thread
// Returns result object instead of console.log for MCP compatibility

import { existsSync } from 'fs';
import { updateThread, updatePending, loadMetaIndex } from '../storage.js';
import { validateTag, resolvePath } from '../utils.js';
import type { OperationResult, AttachResult, AttachInput, Thread } from '../types.js';

export function attachFile(input: AttachInput): OperationResult<AttachResult> {
  try {
    const validatedId = validateTag(input.threadId);
    const resolvedPath = resolvePath(input.filePath);

    // Warn if file doesn't exist but still allow attaching
    const fileExists = existsSync(resolvedPath);

    // Check thread exists via meta (fast)
    const meta = loadMetaIndex();
    if (!meta.threads[validatedId]) {
      return {
        success: false,
        message: `Thread ID '${validatedId}' not found.`,
        error: 'THREAD_NOT_FOUND',
      };
    }

    // Use per-thread locking
    let alreadyLinked = false;

    updateThread(validatedId, (thread: Thread) => {
      const files = thread.linked_files || [];

      if (files.includes(resolvedPath)) {
        alreadyLinked = true;
        return thread;
      }

      files.push(resolvedPath);
      thread.linked_files = files;
      thread.date_modified = new Date().toISOString();

      return thread;
    });

    if (alreadyLinked) {
      return {
        success: true,
        message: `File '${resolvedPath}' is already linked to thread '${validatedId}'.`,
        data: {
          threadId: validatedId,
          filePath: resolvedPath,
          alreadyLinked: true,
        },
      };
    }

    // Remove from pending if it was tracked (also locked)
    updatePending((state) => {
      state.tracked = state.tracked.filter((f) => f.path !== resolvedPath);
      return state;
    });

    const message = fileExists
      ? `File '${resolvedPath}' attached to thread '${validatedId}'.`
      : `File '${resolvedPath}' attached to thread '${validatedId}' (warning: file does not exist).`;

    return {
      success: true,
      message,
      data: {
        threadId: validatedId,
        filePath: resolvedPath,
        alreadyLinked: false,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: 'ATTACH_ERROR',
    };
  }
}

export function detachFile(input: AttachInput): OperationResult<AttachResult> {
  try {
    const validatedId = validateTag(input.threadId);
    const resolvedPath = resolvePath(input.filePath);

    // Check thread exists via meta (fast)
    const meta = loadMetaIndex();
    if (!meta.threads[validatedId]) {
      return {
        success: false,
        message: `Thread ID '${validatedId}' not found.`,
        error: 'THREAD_NOT_FOUND',
      };
    }

    // Use per-thread locking
    let fileNotLinked = false;

    updateThread(validatedId, (thread: Thread) => {
      const files = thread.linked_files || [];

      if (!files.includes(resolvedPath)) {
        fileNotLinked = true;
        return thread;
      }

      thread.linked_files = files.filter((f) => f !== resolvedPath);
      thread.date_modified = new Date().toISOString();

      return thread;
    });

    if (fileNotLinked) {
      return {
        success: false,
        message: `File '${resolvedPath}' is not linked to thread '${validatedId}'.`,
        error: 'FILE_NOT_LINKED',
      };
    }

    return {
      success: true,
      message: `File '${resolvedPath}' detached from thread '${validatedId}'.`,
      data: {
        threadId: validatedId,
        filePath: resolvedPath,
        alreadyLinked: false,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: 'DETACH_ERROR',
    };
  }
}
