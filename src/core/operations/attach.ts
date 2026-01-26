// Attach operation - link a file to a thread
// Returns result object instead of console.log for MCP compatibility

import { existsSync } from 'fs';
import { loadIndex, saveIndex, removeFromPending } from '../storage.js';
import { validateTag, resolvePath } from '../utils.js';
import type { OperationResult, AttachResult, AttachInput } from '../types.js';

export function attachFile(input: AttachInput): OperationResult<AttachResult> {
  try {
    const index = loadIndex();
    const validatedId = validateTag(input.threadId);

    if (!index[validatedId]) {
      return {
        success: false,
        message: `Thread ID '${validatedId}' not found.`,
        error: 'THREAD_NOT_FOUND',
      };
    }

    const resolvedPath = resolvePath(input.filePath);

    // Warn if file doesn't exist but still allow attaching
    const fileExists = existsSync(resolvedPath);

    const files = index[validatedId].linked_files || [];

    if (files.includes(resolvedPath)) {
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

    files.push(resolvedPath);
    index[validatedId].linked_files = files;
    index[validatedId].date_modified = new Date().toISOString();

    saveIndex(index);

    // Remove from pending if it was tracked
    removeFromPending(resolvedPath);

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
    const index = loadIndex();
    const validatedId = validateTag(input.threadId);

    if (!index[validatedId]) {
      return {
        success: false,
        message: `Thread ID '${validatedId}' not found.`,
        error: 'THREAD_NOT_FOUND',
      };
    }

    const resolvedPath = resolvePath(input.filePath);
    const files = index[validatedId].linked_files || [];

    if (!files.includes(resolvedPath)) {
      return {
        success: false,
        message: `File '${resolvedPath}' is not linked to thread '${validatedId}'.`,
        error: 'FILE_NOT_LINKED',
      };
    }

    index[validatedId].linked_files = files.filter((f) => f !== resolvedPath);
    index[validatedId].date_modified = new Date().toISOString();

    saveIndex(index);

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
