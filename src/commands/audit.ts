import { Command } from 'commander';
import { existsSync } from 'fs';
import { loadIndex } from '../core/index.js';

interface AuditResult {
  broken: Array<{ threadId: string; path: string }>;
  orphans: string[];
  stale: string[];
  duplicates: Map<string, string[]>;
}

export const auditCommand = new Command('audit')
  .description('Audit thread index for issues')
  .option('--stale <days>', 'Days to consider stale', parseInt, 90)
  .action((options) => {
    try {
      const index = loadIndex();
      const now = new Date();
      const staleDays = options.stale || 90;

      const result: AuditResult = {
        broken: [],
        orphans: [],
        stale: [],
        duplicates: new Map(),
      };

      for (const [threadId, thread] of Object.entries(index)) {
        // Check for invalid thread data
        if (typeof thread !== 'object' || thread === null) {
          result.orphans.push(threadId);
          continue;
        }

        const files = thread.linked_files || [];

        // Check for orphan threads (no summary and no files)
        if (!thread.summary && files.length === 0) {
          result.orphans.push(threadId);
        }

        // Check for broken paths
        for (const filePath of files) {
          if (!existsSync(filePath)) {
            result.broken.push({ threadId, path: filePath });
          }

          // Track duplicates
          const existing = result.duplicates.get(filePath) || [];
          existing.push(threadId);
          result.duplicates.set(filePath, existing);
        }

        // Check for stale threads
        const dateStr = thread.date_modified || thread.date_created;
        if (dateStr) {
          const date = new Date(dateStr);
          const daysOld = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
          if (daysOld > staleDays) {
            result.stale.push(threadId);
          }
        }
      }

      // Filter duplicates to only show actual duplicates (more than one thread)
      const actualDuplicates = new Map(
        [...result.duplicates.entries()].filter(([_, threads]) => threads.length > 1)
      );

      // Report
      console.log(`Broken paths: ${result.broken.length}`);
      result.broken.slice(0, 5).forEach(({ threadId, path }) => {
        console.log(`  x ${threadId}: ${path}`);
      });
      if (result.broken.length > 5) {
        console.log('  ...');
      }

      console.log(`Orphan threads: ${result.orphans.length}`);
      console.log(`Stale threads (> ${staleDays}d): ${result.stale.length}`);
      console.log(`Duplicates: ${actualDuplicates.size}`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
    }
  });
