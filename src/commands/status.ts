import { Command } from 'commander';

export const statusCommand = new Command('status')
  .description('Show available features')
  .option('--json', 'Output as JSON')
  .action((options) => {
    const features = {
      core: ['snippet', 'attach', 'detach', 'explain', 'show', 'list', 'search', 'create'],
      advanced: ['semantic_search', 'analytics', 'export'],
    };

    if (options.json) {
      console.log(JSON.stringify({ features, version: '2.0.0' }, null, 2));
      return;
    }

    console.log();
    console.log('  Threadlinking v2.0.0');
    console.log();
    console.log('  Available Features:');
    console.log();
    console.log('    Core:');
    console.log('      - snippet, attach, detach, explain');
    console.log('      - show, list, search, create');
    console.log();
    console.log('    Advanced:');
    console.log('      - semantic_search (natural language search)');
    console.log('      - analytics (usage insights)');
    console.log('      - export (markdown, JSON, timeline)');
    console.log();
    console.log('  Docs: https://github.com/thrialectics/threadlinking');
    console.log();
  });
