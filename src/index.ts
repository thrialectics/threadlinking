#!/usr/bin/env node
import { Command } from 'commander';
import { snippetCommand } from './commands/snippet.js';
import { createCommand } from './commands/create.js';
import { attachCommand } from './commands/attach.js';
import { detachCommand } from './commands/detach.js';
import { showCommand } from './commands/show.js';
import { explainCommand } from './commands/explain.js';
import { listCommand } from './commands/list.js';
import { searchCommand } from './commands/search.js';
import { deleteCommand } from './commands/delete.js';
import { updateCommand } from './commands/update.js';
import { renameCommand } from './commands/rename.js';
import { auditCommand } from './commands/audit.js';
import { clearCommand } from './commands/clear.js';
import { initCommand } from './commands/init.js';
import { trackCommand } from './commands/track.js';
import { statusCommand } from './commands/status.js';
import { reindexCommand } from './commands/reindex.js';
import { semanticSearchCommand } from './commands/semantic-search.js';

const program = new Command();

program
  .name('threadlinking')
  .description('Connect your files with their origin stories')
  .version('2.0.4');

// Core commands
program.addCommand(snippetCommand);
program.addCommand(createCommand);
program.addCommand(attachCommand);
program.addCommand(detachCommand);
program.addCommand(showCommand);
program.addCommand(explainCommand);
program.addCommand(listCommand);
program.addCommand(searchCommand);

// Maintenance commands
program.addCommand(updateCommand);
program.addCommand(renameCommand);
program.addCommand(deleteCommand);
program.addCommand(auditCommand);
program.addCommand(clearCommand);

// Setup commands
program.addCommand(initCommand);
program.addCommand(trackCommand);

// Info commands
program.addCommand(statusCommand);

// Advanced commands
program.addCommand(reindexCommand);
program.addCommand(semanticSearchCommand);

program.parse();
