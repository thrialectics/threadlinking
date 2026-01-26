import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { join } from 'path';

const CLI_PATH = join(__dirname, '../dist/index.js');

function runCli(args: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args}`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return { stdout, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || error.message,
      exitCode: error.status || 1,
    };
  }
}

describe('CLI', () => {
  it('should show version', () => {
    const { stdout, exitCode } = runCli('--version');
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should show help', () => {
    const { stdout, exitCode } = runCli('--help');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Connect your files with their origin stories');
    expect(stdout).toContain('Commands:');
  });

  it('should list available commands', () => {
    const { stdout, exitCode } = runCli('--help');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('snippet');
    expect(stdout).toContain('attach');
    expect(stdout).toContain('show');
    expect(stdout).toContain('list');
    expect(stdout).toContain('search');
  });

  it('should show status', () => {
    const { stdout, exitCode } = runCli('status');
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/Threadlinking v\d+\.\d+\.\d+/);
    expect(stdout).toContain('Available Features');
  });

  it('should handle list command', () => {
    const { exitCode } = runCli('list');
    // Should not crash - may have 0 threads or some threads
    expect(exitCode).toBe(0);
  });
});
