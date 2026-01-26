# Threadlinking Context

## Project Purpose

Threadlinking is a CLI tool for preserving AI conversation context alongside the files produced during those conversations. It solves the problem of losing the "why" behind code decisions across Claude Code sessions.

**Core concept:** A "thread" is a container for a project or idea (not a task). Threads persist across sessions, accumulating context over months of work. When you return to code weeks later, `threadlinking explain <file>` shows why it exists.

**Key workflow:**
1. Claude detects significant work and prompts: "Should I create a thread?"
2. User confirms thread name (e.g., `myproject`)
3. Claude saves snippets and attaches files as work progresses
4. Future sessions can query the context

## Tech Stack

- **Language:** TypeScript (ES2022, NodeNext modules)
- **Runtime:** Node.js 18+
- **CLI Framework:** Commander.js v12
- **Build:** TypeScript compiler (`tsc`)
- **Package:** ESM module with bin entry point

## Architecture Overview

```
bin/threadlinking          # Entry point (shebang + import)
src/
  index.ts                 # CLI program setup, registers all commands
  types.ts                 # Core types: Thread, Snippet, ThreadIndex
  storage.ts               # File I/O: load/save JSON, pending files
  utils.ts                 # Validation, sanitization, path resolution
  commands/                # One file per CLI command
    snippet.ts             # Add context to thread
    attach.ts              # Link file to thread
    detach.ts              # Unlink file
    show.ts                # View thread details
    explain.ts             # Show context for a file
    list.ts                # List threads + untracked files
    search.ts              # Keyword search across threads
    init.ts                # Setup hooks + CLAUDE.md
    track.ts               # Record file writes (called by hook)
    audit.ts               # Check for broken links
    update.ts              # Modify thread metadata
    rename.ts              # Rename thread ID
    delete.ts              # Remove thread
    clear.ts               # Clear pending files list
```

**Data storage:** `~/.threadlinking/thread_index.json` - single JSON file containing all threads, snippets, and file links. Secure permissions (0600).

**Pending tracking:** `~/.threadlinking/pending.json` - tracks files created/edited that haven't been linked to a thread yet.

## Key Files

| File | Description |
|------|-------------|
| `src/index.ts` | CLI entry point, registers all commands with Commander |
| `src/types.ts` | TypeScript interfaces: `Thread`, `Snippet`, `ThreadIndex` |
| `src/storage.ts` | JSON file I/O with atomic writes and corruption recovery |
| `src/utils.ts` | Input validation, sanitization, path handling, source detection |
| `src/commands/init.ts` | Sets up Claude Code hook and CLAUDE.md instructions |
| `src/commands/snippet.ts` | Core command for adding context (auto-creates threads) |
| `src/commands/explain.ts` | Shows all threads linked to a given file |
| `CLAUDE.md` | Instructions for Claude on how to use threadlinking |
| `ROADMAP.md` | Future plans: tags (v1.x), semantic search (v2) |

## How to Run

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run locally
node dist/index.js <command>

# Or link globally for development
npm link
threadlinking <command>

# Watch mode for development
npm run dev
```

## CLI Commands

**Core:**
- `threadlinking snippet <thread> "content"` - Add context (auto-creates thread)
- `threadlinking attach <thread> <file>` - Link file to thread
- `threadlinking detach <thread> <file>` - Unlink file
- `threadlinking explain <file>` - Show why file exists
- `threadlinking show <thread>` - View thread details
- `threadlinking list` - List all threads + untracked files
- `threadlinking search <query>` - Keyword search

**Setup:**
- `threadlinking init` - Install Claude Code hook + CLAUDE.md
- `threadlinking track <file>` - Track file (called by hook)

**Maintenance:**
- `threadlinking update <thread> --summary "..."` - Update metadata
- `threadlinking rename <old> <new>` - Rename thread
- `threadlinking delete <thread>` - Remove thread
- `threadlinking audit` - Check for broken file links
- `threadlinking clear` - Clear pending files

## Dependencies

**Runtime:**
- `commander` ^12.0.0 - CLI argument parsing

**Dev:**
- `typescript` ^5.0.0 - Type checking and compilation
- `@types/node` ^20.0.0 - Node.js type definitions

## Notable Patterns

1. **Auto-hook installation:** `init` writes to `~/.claude/settings.json` to add a PostToolUse hook that calls `threadlinking track` on every Edit/Write operation

2. **Atomic file writes:** Storage uses temp file + rename to prevent corruption

3. **Input sanitization:** All user input validated and sanitized (null bytes, control chars, length limits)

4. **Source detection:** Automatically detects Claude Code vs ChatGPT vs manual via environment variables

5. **Pending file expiry:** Untracked files auto-expire after 30 days

6. **Snippet tags:** Supports `--tags auth,decision` for organizing within threads

## Project Status

**Active development** - Version 1.1.1 (Dec 2024)

- Core functionality complete and working
- Published to npm
- Used by the author in daily workflow
- Roadmap includes semantic search (v2) and MCP server integration

## Related Projects

- **project-search** (`~/claude-projects/project-search/`) - Semantic search across codebase, integrates with threadlinking context
- **Claude Connect** (planning stage) - System for contextualized Claude instances to communicate; would use threadlinking for context preservation

## Integration Points

- **Claude Code hooks:** PostToolUse hook on Edit/Write operations
- **CLAUDE.md:** Instructions appended to `~/.claude/CLAUDE.md` during init
- **MCP server:** Planned for v2 (native Claude integration without CLI)

## Security Notes

- All data local (no cloud sync, no telemetry)
- Secure file permissions (0600)
- Single minimal dependency (commander)
- Input validation on all user-provided strings
