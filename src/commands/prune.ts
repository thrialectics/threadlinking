import { Command } from 'commander';
import { pruneIgnored } from '../core/index.js';

export const pruneCommand = new Command('prune')
  .description('Remove ignored files from the pending list')
  .option('--verbose', 'Show each removed file')
  .action((options) => {
    const result = pruneIgnored();

    if (!result.success) {
      console.error(`Error: ${result.message}`);
      process.exitCode = 1;
      return;
    }

    console.log(result.message);

    if (options.verbose && result.data && result.data.removed.length > 0) {
      console.log('\nRemoved:');
      for (const path of result.data.removed) {
        console.log(`  - ${path}`);
      }
    }

    if (result.data && result.data.remaining > 0) {
      console.log(`\n${result.data.remaining} file${result.data.remaining > 1 ? 's' : ''} remaining in pending list.`);
    }
  });
