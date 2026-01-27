// Attach operation - link a file to a thread
// Returns result object instead of console.log for MCP compatibility

import { existsSync } from 'fs';
import { updateIndex, updatePending } from '../storage.js';
import { validateTag, resolvePath } from '../utils.js';
import type { OperationResult, AttachResult, AttachInput, ThreadIndex } from '../types.js';

export function attachFile(input: AttachInput): OperationResult<AttachResult> {
  try {
    const validatedId = validateTag(input.threadId);
    const resolvedPath = resolvePath(input.filePath);

    // Warn if file doesn't exist but still allow attaching
    const fileExists = existsSync(resolvedPath);

    // Track result from inside the locked update
    let threadNotFound = false;
    let alreadyLinked = false;

    // Use locked update to prevent race conditions
    updateIndex((index: ThreadIndex) => {
      if (!index[validatedId]) {
        threadNotFound = true;
        return index; // Return unchanged
      }

      const files = index[validatedId].linked_files || [];

      if (files.includes(resolvedPath)) {
        alreadyLinked = true;
        return index; // Return unchanged
      }

      files.push(resolvedPath);
      index[validatedId].linked_files = files;
      index[validatedId].date_modified = new Date().toISOString();

      return index;
    });

    if (threadNotFound) {
      return {
        success: false,
        message: `Thread ID '${validatedId}' not found.`,
        error: 'THREAD_NOT_FOUND',
      };
    }

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

    // Track result from inside the locked update
    let threadNotFound = false;
    let fileNotLinked = false;

    // Use locked update to prevent race conditions
    updateIndex((index: ThreadIndex) => {
      if (!index[validatedId]) {
        threadNotFound = true;
        return index;
      }

      const files = index[validatedId].linked_files || [];

      if (!files.includes(resolvedPath)) {
        fileNotLinked = true;
        return index;
      }

      index[validatedId].linked_files = files.filter((f) => f !== resolvedPath);
      index[validatedId].date_modified = new Date().toISOString();

      return index;
    });

    if (threadNotFound) {
      return {
        success: false,
        message: `Thread ID '${validatedId}' not found.`,
        error: 'THREAD_NOT_FOUND',
      };
    }

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
