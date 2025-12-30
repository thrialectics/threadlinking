import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createInterface } from 'readline';

const CLAUDE_DIR = join(homedir(), '.claude');
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');
const CLAUDE_MD_PATH = join(CLAUDE_DIR, 'CLAUDE.md');

const HOOK_CONFIG = {
  matcher: 'Edit|Write',
  hooks: [
    {
      type: 'command',
      command: "jq -r '.tool_input.file_path // empty' | xargs -I {} threadlinking track --quiet \"{}\"",
    },
  ],
};

const CLAUDE_MD_BLOCK = `
## Threadlinking

**Threadlinking preserves conversation context across sessions.** Use it actively.

### Session Protocol

**Starting a session:**
1. Run \`threadlinking list\` to see active threads and untracked files

**During a session:**
- Before modifying significant files: \`threadlinking explain path/to/file\`
- When creating files or making decisions: \`threadlinking snippet THREAD "why"\`
- Link files to threads: \`threadlinking attach THREAD path/to/file\`

### Commands

\`\`\`
threadlinking list                        # See threads + untracked files
threadlinking explain path/to/file        # Check context before modifying
threadlinking snippet THREAD "why"        # Save decision context
threadlinking attach THREAD path/to/file  # Link file to thread
threadlinking search "keyword"            # Find relevant threads
\`\`\`

### Thread Naming

Threads = projects, not tasks. Good: \`myproject\`, \`client_acme\`. Bad: \`auth_v2\`, \`fix_bug_123\`.
`;

function ask(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function installHook(): Promise<boolean> {
  // Ensure ~/.claude exists
  if (!existsSync(CLAUDE_DIR)) {
    mkdirSync(CLAUDE_DIR, { recursive: true });
  }

  let settings: Record<string, unknown> = {};

  // Load existing settings
  if (existsSync(SETTINGS_PATH)) {
    try {
      const data = readFileSync(SETTINGS_PATH, 'utf-8');
      settings = JSON.parse(data);
    } catch {
      console.error('  Warning: Could not parse existing settings.json');
    }
  }

  // Initialize hooks structure if needed
  if (!settings.hooks) {
    settings.hooks = {};
  }
  const hooks = settings.hooks as Record<string, unknown[]>;

  if (!hooks.PostToolUse) {
    hooks.PostToolUse = [];
  }

  // Check if threadlinking hook already exists
  const postToolUse = hooks.PostToolUse as Array<{ matcher?: string }>;
  const existingHook = postToolUse.find(
    (h) => h.matcher === 'Edit|Write' && JSON.stringify(h).includes('threadlinking')
  );

  if (existingHook) {
    console.log('  Hook already installed, skipping');
    return true;
  }

  // Add our hook
  postToolUse.push(HOOK_CONFIG);

  // Write settings
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
  return true;
}

function installClaudeMd(): boolean {
  // Check if CLAUDE.md exists and already has threadlinking
  if (existsSync(CLAUDE_MD_PATH)) {
    const content = readFileSync(CLAUDE_MD_PATH, 'utf-8');
    if (content.includes('## Threadlinking') || content.includes('threadlinking')) {
      console.log('  CLAUDE.md already contains threadlinking instructions, skipping');
      return true;
    }
  }

  // Append the block
  appendFileSync(CLAUDE_MD_PATH, CLAUDE_MD_BLOCK, 'utf-8');
  return true;
}

export const initCommand = new Command('init')
  .description('Set up threadlinking with Claude Code hooks')
  .option('--no-interactive', 'Skip prompts, install everything')
  .action(async (options) => {
    console.log('\nSetting up threadlinking...\n');

    // Step 1: Install hook
    console.log('[1/2] Installing Claude Code hook...');
    console.log('      Writing to ~/.claude/settings.json');
    try {
      await installHook();
      console.log('      ✓ Hook installed (tracks file writes automatically)\n');
    } catch (error) {
      console.error(`      ✗ Failed: ${error instanceof Error ? error.message : error}`);
      return;
    }

    // Step 2: CLAUDE.md
    console.log('[2/2] CLAUDE.md instructions');
    let shouldInstallMd = true;

    if (options.interactive !== false) {
      const answer = await ask('      Append threadlinking block to ~/.claude/CLAUDE.md? (Y/n) ');
      shouldInstallMd = answer !== 'n' && answer !== 'no';
    }

    if (shouldInstallMd) {
      try {
        installClaudeMd();
        console.log('      ✓ Instructions added\n');
      } catch (error) {
        console.error(`      ✗ Failed: ${error instanceof Error ? error.message : error}`);
      }
    } else {
      console.log('      Skipped\n');
    }

    // Done
    console.log('Done! Threadlinking will now:');
    console.log('  • Automatically track files you create/edit');
    console.log('  • Show untracked files when you run `threadlinking list`');
    console.log('  • Help Claude prompt you to save context\n');
    console.log('Start a new Claude Code session to begin.\n');
  });
