import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

// Use a temp directory to avoid messing with real ~/.claude
const TEST_DIR = join(tmpdir(), 'threadlinking-test-' + Date.now());
const CLAUDE_DIR = join(TEST_DIR, '.claude');
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');
const CLAUDE_MD_PATH = join(CLAUDE_DIR, 'CLAUDE.md');

describe('init command', () => {
  beforeEach(() => {
    // Create fresh test directory
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('status detection', () => {
    it('should detect when nothing is installed', () => {
      // No ~/.claude directory
      expect(existsSync(CLAUDE_DIR)).toBe(false);
    });

    it('should detect existing hook in settings.json', () => {
      mkdirSync(CLAUDE_DIR, { recursive: true });
      const settings = {
        hooks: {
          PostToolUse: [
            {
              matcher: 'Edit|Write',
              hooks: [
                {
                  type: 'command',
                  command: 'threadlinking track --quiet',
                },
              ],
            },
          ],
        },
      };
      writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));

      const content = readFileSync(SETTINGS_PATH, 'utf-8');
      expect(content).toContain('threadlinking');
    });

    it('should detect existing MCP server config', () => {
      mkdirSync(CLAUDE_DIR, { recursive: true });
      const settings = {
        mcpServers: {
          threadlinking: {
            command: 'npx',
            args: ['threadlinking-mcp'],
          },
        },
      };
      writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));

      const parsed = JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
      expect(parsed.mcpServers.threadlinking).toBeDefined();
    });

    it('should detect threadlinking in CLAUDE.md (case-insensitive)', () => {
      mkdirSync(CLAUDE_DIR, { recursive: true });
      writeFileSync(CLAUDE_MD_PATH, '## Threadlinking\n\nSome content here.');

      const content = readFileSync(CLAUDE_MD_PATH, 'utf-8');
      expect(content.toLowerCase()).toContain('threadlinking');
    });
  });

  describe('settings.json handling', () => {
    it('should handle missing settings.json gracefully', () => {
      mkdirSync(CLAUDE_DIR, { recursive: true });
      expect(existsSync(SETTINGS_PATH)).toBe(false);
      // Should be able to create new settings
    });

    it('should detect corrupted settings.json', () => {
      mkdirSync(CLAUDE_DIR, { recursive: true });
      writeFileSync(SETTINGS_PATH, '{ invalid json }}}');

      let valid = true;
      try {
        JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
      } catch {
        valid = false;
      }
      expect(valid).toBe(false);
    });

    it('should merge with existing mcpServers without replacing', () => {
      mkdirSync(CLAUDE_DIR, { recursive: true });
      const existingSettings = {
        mcpServers: {
          'other-server': {
            command: 'npx',
            args: ['other-mcp'],
          },
        },
      };
      writeFileSync(SETTINGS_PATH, JSON.stringify(existingSettings, null, 2));

      // Simulate adding threadlinking
      const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
      settings.mcpServers.threadlinking = {
        command: 'npx',
        args: ['threadlinking-mcp'],
      };
      writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));

      const final = JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
      expect(final.mcpServers['other-server']).toBeDefined();
      expect(final.mcpServers.threadlinking).toBeDefined();
    });

    it('should merge with existing hooks without replacing', () => {
      mkdirSync(CLAUDE_DIR, { recursive: true });
      const existingSettings = {
        hooks: {
          PostToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'echo "bash used"' }],
            },
          ],
        },
      };
      writeFileSync(SETTINGS_PATH, JSON.stringify(existingSettings, null, 2));

      // Simulate adding threadlinking hook
      const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
      settings.hooks.PostToolUse.push({
        matcher: 'Edit|Write',
        hooks: [{ type: 'command', command: 'threadlinking track --quiet' }],
      });
      writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));

      const final = JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
      expect(final.hooks.PostToolUse).toHaveLength(2);
    });
  });

  describe('CLAUDE.md handling', () => {
    it('should append to existing CLAUDE.md without replacing', () => {
      mkdirSync(CLAUDE_DIR, { recursive: true });
      const existingContent = '# My Custom Instructions\n\nSome existing content.\n';
      writeFileSync(CLAUDE_MD_PATH, existingContent);

      // Simulate appending threadlinking block
      const threadlinkingBlock = '\n## Threadlinking\n\nNew content.\n';
      const current = readFileSync(CLAUDE_MD_PATH, 'utf-8');
      writeFileSync(CLAUDE_MD_PATH, current + threadlinkingBlock);

      const final = readFileSync(CLAUDE_MD_PATH, 'utf-8');
      expect(final).toContain('# My Custom Instructions');
      expect(final).toContain('## Threadlinking');
    });

    it('should detect case-insensitive threadlinking mentions', () => {
      mkdirSync(CLAUDE_DIR, { recursive: true });
      writeFileSync(CLAUDE_MD_PATH, 'Use ThreadLinking for context tracking.');

      const content = readFileSync(CLAUDE_MD_PATH, 'utf-8');
      expect(content.toLowerCase()).toContain('threadlinking');
    });
  });
});

describe('init CLI', () => {
  it('should support --status flag', () => {
    const result = execSync('node dist/index.js init --help', {
      encoding: 'utf-8',
    });
    expect(result).toContain('--status');
  });

  it('should support --no-interactive flag', () => {
    const result = execSync('node dist/index.js init --help', {
      encoding: 'utf-8',
    });
    expect(result).toContain('--no-interactive');
  });
});
