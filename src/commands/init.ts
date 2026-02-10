import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, copyFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createInterface } from 'readline';

const CLAUDE_DIR = join(homedir(), '.claude');
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');
const MCP_JSON_PATH = join(CLAUDE_DIR, 'mcp.json');
const CLAUDE_MD_PATH = join(CLAUDE_DIR, 'CLAUDE.md');

const POST_TOOL_USE_HOOK_CONFIG = {
  matcher: 'Edit|Write',
  hooks: [
    {
      type: 'command',
      command: "jq -r '.tool_input.file_path // empty' | while read -r f; do [ -n \"$f\" ] && npx threadlinking track --quiet \"$f\"; done",
      async: true,  // Don't block Claude - this is just logging
    },
  ],
};

const SESSION_START_HOOK_CONFIG = {
  hooks: [
    {
      type: 'command',
      command: 'npx threadlinking context',
    },
  ],
};

const MCP_SERVER_CONFIG = {
  command: 'npx',
  args: ['threadlinking-mcp'],
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
\`\`\`

### Searching Context

**Use semantic search for conceptual questions** (preferred when index exists):
\`\`\`
threadlinking semantic-search "why did we choose this architecture"
threadlinking semantic-search "decisions about authentication"
\`\`\`

**Use keyword search for specific terms:**
\`\`\`
threadlinking search "PostgreSQL"
threadlinking search "rate limiting"
\`\`\`

If semantic search returns "index not found", the user needs to run \`threadlinking reindex\` first.

### Thread Naming

Threads = projects, not tasks. Good: \`myproject\`, \`client_acme\`. Bad: \`auth_v2\`, \`fix_bug_123\`.
`;

interface SetupStatus {
  claudeCodeDetected: boolean;
  claudeDirExists: boolean;
  postToolUseHookInstalled: boolean;
  sessionStartHookInstalled: boolean;
  mcpConfigured: boolean;
  claudeMdPresent: boolean;
  settingsJsonValid: boolean;
  mcpJsonValid: boolean;
}

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

function loadSettings(): { settings: Record<string, unknown>; valid: boolean } {
  if (!existsSync(SETTINGS_PATH)) {
    return { settings: {}, valid: true };
  }

  try {
    const data = readFileSync(SETTINGS_PATH, 'utf-8');
    return { settings: JSON.parse(data), valid: true };
  } catch {
    return { settings: {}, valid: false };
  }
}

function loadMcpJson(): { mcpJson: Record<string, unknown>; valid: boolean } {
  if (!existsSync(MCP_JSON_PATH)) {
    return { mcpJson: {}, valid: true };
  }

  try {
    const data = readFileSync(MCP_JSON_PATH, 'utf-8');
    return { mcpJson: JSON.parse(data), valid: true };
  } catch {
    return { mcpJson: {}, valid: false };
  }
}

function checkStatus(): SetupStatus {
  const claudeDirExists = existsSync(CLAUDE_DIR);
  const claudeCodeDetected = claudeDirExists; // If ~/.claude exists, Claude Code is likely installed

  const { settings, valid: settingsJsonValid } = loadSettings();

  // Check PostToolUse hook
  let postToolUseHookInstalled = false;
  if (settingsJsonValid && settings.hooks) {
    const hooks = settings.hooks as Record<string, unknown[]>;
    if (hooks.PostToolUse) {
      const postToolUse = hooks.PostToolUse as Array<{ matcher?: string }>;
      postToolUseHookInstalled = postToolUse.some(
        (h) => JSON.stringify(h).includes('threadlinking')
      );
    }
  }

  // Check SessionStart hook
  let sessionStartHookInstalled = false;
  if (settingsJsonValid && settings.hooks) {
    const hooks = settings.hooks as Record<string, unknown[]>;
    if (hooks.SessionStart) {
      const sessionStart = hooks.SessionStart as Array<{ command?: string }>;
      sessionStartHookInstalled = sessionStart.some(
        (h) => JSON.stringify(h).includes('threadlinking')
      );
    }
  }

  // Check MCP server (in mcp.json)
  const { mcpJson, valid: mcpJsonValid } = loadMcpJson();
  let mcpConfigured = false;
  if (mcpJsonValid && mcpJson.mcpServers) {
    const mcpServers = mcpJson.mcpServers as Record<string, unknown>;
    mcpConfigured = 'threadlinking' in mcpServers;
  }

  // Check CLAUDE.md (case-insensitive)
  let claudeMdPresent = false;
  if (existsSync(CLAUDE_MD_PATH)) {
    const content = readFileSync(CLAUDE_MD_PATH, 'utf-8');
    claudeMdPresent = content.toLowerCase().includes('threadlinking');
  }

  return {
    claudeCodeDetected,
    claudeDirExists,
    postToolUseHookInstalled,
    sessionStartHookInstalled,
    mcpConfigured,
    claudeMdPresent,
    settingsJsonValid,
    mcpJsonValid,
  };
}

function backupAndFixSettings(): boolean {
  if (!existsSync(SETTINGS_PATH)) {
    return true;
  }

  const backupPath = `${SETTINGS_PATH}.backup.${Date.now()}`;
  try {
    copyFileSync(SETTINGS_PATH, backupPath);
    console.log(`      Backed up to ${backupPath}`);
    writeFileSync(SETTINGS_PATH, '{}', 'utf-8');
    return true;
  } catch (error) {
    console.error(`      Failed to backup: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

function installPostToolUseHook(settings: Record<string, unknown>): boolean {
  // Ensure ~/.claude exists
  if (!existsSync(CLAUDE_DIR)) {
    mkdirSync(CLAUDE_DIR, { recursive: true });
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
    (h) => JSON.stringify(h).includes('threadlinking')
  );

  if (existingHook) {
    return false; // Already installed
  }

  // Add our hook
  postToolUse.push(POST_TOOL_USE_HOOK_CONFIG);
  return true;
}

function installSessionStartHook(settings: Record<string, unknown>): boolean {
  // Ensure ~/.claude exists
  if (!existsSync(CLAUDE_DIR)) {
    mkdirSync(CLAUDE_DIR, { recursive: true });
  }

  // Initialize hooks structure if needed
  if (!settings.hooks) {
    settings.hooks = {};
  }
  const hooks = settings.hooks as Record<string, unknown[]>;

  if (!hooks.SessionStart) {
    hooks.SessionStart = [];
  }

  // Check if threadlinking hook already exists
  const sessionStart = hooks.SessionStart as Array<{ hooks?: Array<{ command?: string }> }>;
  const existingHook = sessionStart.find(
    (h) => JSON.stringify(h).includes('threadlinking')
  );

  if (existingHook) {
    return false; // Already installed
  }

  // Add our hook
  sessionStart.push(SESSION_START_HOOK_CONFIG);
  return true;
}

function installMcpServer(mcpJson: Record<string, unknown>): boolean {
  // Ensure ~/.claude exists
  if (!existsSync(CLAUDE_DIR)) {
    mkdirSync(CLAUDE_DIR, { recursive: true });
  }

  // Initialize mcpServers if needed
  if (!mcpJson.mcpServers) {
    mcpJson.mcpServers = {};
  }
  const mcpServers = mcpJson.mcpServers as Record<string, unknown>;

  // Check if already configured
  if ('threadlinking' in mcpServers) {
    return false; // Already configured
  }

  // Add our MCP server
  mcpServers.threadlinking = MCP_SERVER_CONFIG;
  return true;
}

function installClaudeMd(): boolean {
  // Check if CLAUDE.md exists and already has threadlinking (case-insensitive)
  if (existsSync(CLAUDE_MD_PATH)) {
    const content = readFileSync(CLAUDE_MD_PATH, 'utf-8');
    if (content.toLowerCase().includes('threadlinking')) {
      return false; // Already present
    }
  }

  // Append the block
  appendFileSync(CLAUDE_MD_PATH, CLAUDE_MD_BLOCK, 'utf-8');
  return true;
}

function printStatus(status: SetupStatus): void {
  console.log('\nThreadlinking setup status:\n');
  console.log(`  Claude Code:        ${status.claudeCodeDetected ? '\u2713 Detected' : '\u2717 Not detected'}`);
  console.log(`  PostToolUse hook:   ${status.postToolUseHookInstalled ? '\u2713 Installed' : '\u2717 Not installed'}`);
  console.log(`  SessionStart hook:  ${status.sessionStartHookInstalled ? '\u2713 Installed' : '\u2717 Not installed'}`);
  console.log(`  MCP server:         ${status.mcpConfigured ? '\u2713 Configured (mcp.json)' : '\u2717 Not configured'}`);
  console.log(`  CLAUDE.md:          ${status.claudeMdPresent ? '\u2713 Present' : '\u2717 Not present'}`);

  if (!status.settingsJsonValid && existsSync(SETTINGS_PATH)) {
    console.log(`  settings.json:      \u2717 Invalid JSON`);
  }
  if (!status.mcpJsonValid && existsSync(MCP_JSON_PATH)) {
    console.log(`  mcp.json:           \u2717 Invalid JSON`);
  }
  console.log('');
}

export const initCommand = new Command('init')
  .description('Set up threadlinking with Claude Code (hooks, MCP server, instructions)')
  .option('--no-interactive', 'Skip prompts, install everything')
  .option('--status', 'Show current setup status without making changes')
  .action(async (options) => {
    const status = checkStatus();

    // Status-only mode
    if (options.status) {
      printStatus(status);
      return;
    }

    console.log('\nSetting up threadlinking...\n');

    // Preamble: Check environment
    console.log('Checking environment...');
    if (status.claudeCodeDetected) {
      console.log('  \u2713 Claude Code detected');
    } else {
      console.log('  \u2717 Claude Code not detected (no ~/.claude directory)');
      console.log('  Creating ~/.claude directory...');
      mkdirSync(CLAUDE_DIR, { recursive: true });
      console.log('  \u2713 Created ~/.claude');
    }
    console.log('  \u2713 ~/.claude directory exists\n');

    // Handle invalid settings.json
    let { settings, valid: settingsValid } = loadSettings();
    if (!settingsValid && existsSync(SETTINGS_PATH)) {
      console.log('  \u26a0 settings.json exists but is not valid JSON');
      let shouldFix = true;
      if (options.interactive !== false) {
        const answer = await ask('  Back up and reset settings.json? (Y/n) ');
        shouldFix = answer !== 'n' && answer !== 'no';
      }
      if (shouldFix) {
        if (backupAndFixSettings()) {
          settings = {};
          settingsValid = true;
          console.log('  \u2713 settings.json reset\n');
        } else {
          console.log('  \u2717 Could not fix settings.json, aborting\n');
          return;
        }
      } else {
        console.log('  Aborting - please fix settings.json manually\n');
        return;
      }
    }

    // Step 1: PostToolUse hook
    console.log('[1/4] PostToolUse hook (auto-tracks files you create)');
    if (status.postToolUseHookInstalled) {
      console.log('      Status: Already installed');
      console.log('      \u2713 Skipping\n');
    } else {
      console.log('      Status: Not installed');
      let shouldInstall = true;
      if (options.interactive !== false) {
        const answer = await ask('      Install to ~/.claude/settings.json? (Y/n) ');
        shouldInstall = answer !== 'n' && answer !== 'no';
      }
      if (shouldInstall) {
        installPostToolUseHook(settings);
        writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
        console.log('      \u2713 Hook installed\n');
      } else {
        console.log('      Skipped\n');
      }
    }

    // Reload settings in case they changed
    let reloaded = loadSettings();
    if (reloaded.valid) {
      settings = reloaded.settings;
    }

    // Step 2: SessionStart hook
    console.log('[2/4] SessionStart hook (shows context at session start)');
    if (status.sessionStartHookInstalled) {
      console.log('      Status: Already installed');
      console.log('      \u2713 Skipping\n');
    } else {
      console.log('      Status: Not installed');
      let shouldInstall = true;
      if (options.interactive !== false) {
        const answer = await ask('      Install to ~/.claude/settings.json? (Y/n) ');
        shouldInstall = answer !== 'n' && answer !== 'no';
      }
      if (shouldInstall) {
        installSessionStartHook(settings);
        writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
        console.log('      \u2713 Hook installed\n');
      } else {
        console.log('      Skipped\n');
      }
    }

    // Step 3: MCP Server (uses separate mcp.json file)
    console.log('[3/4] MCP Server (gives Claude direct access to threadlinking tools)');
    let { mcpJson, valid: mcpJsonValid } = loadMcpJson();

    // Handle invalid mcp.json
    if (!mcpJsonValid && existsSync(MCP_JSON_PATH)) {
      console.log('      \u26a0 mcp.json exists but is not valid JSON');
      let shouldFix = true;
      if (options.interactive !== false) {
        const answer = await ask('      Back up and reset mcp.json? (Y/n) ');
        shouldFix = answer !== 'n' && answer !== 'no';
      }
      if (shouldFix) {
        const backupPath = `${MCP_JSON_PATH}.backup.${Date.now()}`;
        try {
          copyFileSync(MCP_JSON_PATH, backupPath);
          console.log(`      Backed up to ${backupPath}`);
          writeFileSync(MCP_JSON_PATH, '{}', 'utf-8');
          mcpJson = {};
          mcpJsonValid = true;
          console.log('      \u2713 mcp.json reset');
        } catch (error) {
          console.error(`      Failed to backup: ${error instanceof Error ? error.message : error}`);
          console.log('      Skipping MCP server setup\n');
          mcpJsonValid = false;
        }
      } else {
        console.log('      Skipping MCP server setup - please fix mcp.json manually\n');
        mcpJsonValid = false;
      }
    }

    if (mcpJsonValid) {
      const mcpAlreadyConfigured = mcpJson.mcpServers &&
        'threadlinking' in (mcpJson.mcpServers as Record<string, unknown>);

      if (mcpAlreadyConfigured) {
        console.log('      Status: Already configured');
        console.log('      \u2713 Skipping\n');
      } else {
        console.log('      Status: Not configured');
        let shouldInstall = true;
        if (options.interactive !== false) {
          const answer = await ask('      Add to ~/.claude/mcp.json? (Y/n) ');
          shouldInstall = answer !== 'n' && answer !== 'no';
        }
        if (shouldInstall) {
          installMcpServer(mcpJson);
          writeFileSync(MCP_JSON_PATH, JSON.stringify(mcpJson, null, 2), 'utf-8');
          console.log('      \u2713 MCP server configured\n');
        } else {
          console.log('      Skipped\n');
        }
      }
    }

    // Step 4: CLAUDE.md
    console.log('[4/4] CLAUDE.md instructions (teaches Claude when/how to use threadlinking)');
    if (status.claudeMdPresent) {
      console.log('      Status: Already present');
      console.log('      \u2713 Skipping\n');
    } else {
      console.log('      Status: Not present');
      let shouldInstall = true;
      if (options.interactive !== false) {
        const answer = await ask('      Append to ~/.claude/CLAUDE.md? (Y/n) ');
        shouldInstall = answer !== 'n' && answer !== 'no';
      }
      if (shouldInstall) {
        installClaudeMd();
        console.log('      \u2713 Instructions added\n');
      } else {
        console.log('      Skipped\n');
      }
    }

    // Done
    console.log('Done! Threadlinking is fully configured.\n');
    console.log('Start a new Claude Code session to begin.');
    console.log('Tip: Run `threadlinking list` to see your threads.\n');
  });
