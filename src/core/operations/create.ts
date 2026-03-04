// Create operation - create a new empty thread
// Returns result object for MCP compatibility

import { loadMetaIndex, saveThread } from '../storage.js';
import { validateTag, sanitizeString } from '../utils.js';
import type { OperationResult, Thread } from '../types.js';

export interface CreateInput {
  threadId: string;
  summary?: string;
  chatUrl?: string;
}

export interface CreateResult {
  threadId: string;
  created: boolean;
}

export function createThread(input: CreateInput): OperationResult<CreateResult> {
  try {
    const validatedId = validateTag(input.threadId);

    // Check if thread already exists via meta index (fast)
    const meta = loadMetaIndex();
    if (meta.threads[validatedId]) {
      return {
        success: false,
        message: `Thread '${validatedId}' already exists.`,
        error: 'THREAD_EXISTS',
      };
    }

    // Sanitize and validate summary if provided
    const summary = input.summary
      ? sanitizeString(input.summary).slice(0, 500)
      : '(empty thread)';

    const chatUrl = input.chatUrl
      ? sanitizeString(input.chatUrl).slice(0, 1000)
      : '';

    // Create thread
    const thread: Thread = {
      summary,
      snippets: [],
      linked_files: [],
      chat_url: chatUrl,
      date_created: new Date().toISOString(),
    };

    saveThread(validatedId, thread);

    return {
      success: true,
      message: `Thread '${validatedId}' created.`,
      data: {
        threadId: validatedId,
        created: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: 'CREATE_ERROR',
    };
  }
}
