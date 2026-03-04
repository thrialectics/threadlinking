// Prune operation - remove ignored files from pending list
// Cleans up entries that match .threadlinkingignore patterns

import { loadPending, savePending } from '../storage.js';
import { isIgnored } from '../ignore.js';
import type { OperationResult } from '../types.js';

export interface PruneResult {
  removed: string[];
  remaining: number;
}

export function pruneIgnored(): OperationResult<PruneResult> {
  try {
    const pending = loadPending();
    const removed: string[] = [];

    const filtered = pending.tracked.filter((f) => {
      if (isIgnored(f.path)) {
        removed.push(f.path);
        return false;
      }
      return true;
    });

    savePending({ tracked: filtered });

    const message =
      removed.length === 0
        ? 'No ignored files found in pending list.'
        : `Pruned ${removed.length} ignored file${removed.length > 1 ? 's' : ''} from pending list.`;

    return {
      success: true,
      message,
      data: {
        removed,
        remaining: filtered.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: 'PRUNE_ERROR',
    };
  }
}
