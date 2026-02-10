# Threadlinking

> Connect your files with their origin stories

Threadlinking is a Claude Code native tool for preserving conversation context alongside the files you create.

You're working with Claude on a project. It creates files, makes design decisions, solves problems. A week later, you're looking at the code wondering:

> "What was the context? What was I thinking?"

Threadlinking solves this. Claude automatically saves the relevant conversation snippets when creating files, so you can always trace back to the "why."

**The key insight:** A thread is a container for an **idea or project**, not a feature or task. One thread might span months of work, dozens of files, and hundreds of snippets across multiple repos. When you start a new Claude session next week, threadlinking connects it back to the earlier conversations - preserving context across the gaps.

---

## Installation

### Quick Start

Install globally and run the guided setup:

```bash
npm install -g threadlinking
threadlinking init
```

The global install is required because Threadlinking's hooks need `threadlinking` available as a command between sessions. The setup walks you through everything:

```
Setting up threadlinking...

Checking environment...
  ✓ Claude Code detected
  ✓ ~/.claude directory exists

[1/4] PostToolUse hook (auto-tracks files you create)
      Status: Not installed
      Install to ~/.claude/settings.json? (Y/n) y
      ✓ Hook installed

[2/4] SessionStart hook (shows context at session start)
      Status: Not installed
      Install to ~/.claude/settings.json? (Y/n) y
      ✓ Hook installed

[3/4] MCP Server (gives Claude direct access to threadlinking tools)
      Status: Not configured
      Add to ~/.claude/settings.json mcpServers? (Y/n) y
      ✓ MCP server configured

[4/4] CLAUDE.md instructions (teaches Claude when/how to use threadlinking)
      Status: Not present
      Append to ~/.claude/CLAUDE.md? (Y/n) y
      ✓ Instructions added

Done! Threadlinking is fully configured.

Start a new Claude Code session to begin.
Tip: Run `threadlinking list` to see your threads.
```

**Check your setup anytime:**
```bash
threadlinking init --status
```

**Non-interactive install (scripts/CI):**
```bash
threadlinking init --no-interactive
```

### Standalone CLI (No AI Integration)

Threadlinking also works as a standalone CLI tool without any Claude/AI integration. If you just want to manually track context for your projects, skip the `init` and use it directly:

```bash
# Create a thread and add context
threadlinking snippet myproject "Starting auth module with JWT"

# Link files to threads
threadlinking attach myproject src/auth/jwt.ts

# Later, check why a file exists
threadlinking explain src/auth/jwt.ts

# See all your threads
threadlinking list
```

See [Commands](#commands) for the full reference.

### Manual Setup

If you prefer to configure components individually instead of using `init`:

**MCP Server only** (Claude Desktop or Claude Code):

```json
// ~/.claude/mcp.json (Claude Code)
// or ~/Library/Application Support/Claude/claude_desktop_config.json (Claude Desktop)
{
  "mcpServers": {
    "threadlinking": {
      "command": "threadlinking-mcp"
    }
  }
}
```

### What Gets Installed

| Component | Purpose | Location |
|-----------|---------|----------|
| PostToolUse hook | Auto-tracks files you create/edit | `~/.claude/settings.json` |
| MCP Server | Gives Claude direct tool access | `~/.claude/mcp.json` |
| CLAUDE.md block | Teaches Claude when/how to use threadlinking | `~/.claude/CLAUDE.md` |

All components are optional and can be skipped during init.

---

## How It Works

Claude automatically detects when you're doing work worth preserving and prompts you:

```
You: "Let's build a new authentication system using JWT"
Claude: "This looks like work worth preserving context for. Should I create
        a thread for this? I'd suggest 'myproject' - or name it something else."
You: "Call it auth_system"
Claude: [remembers: current thread = auth_system]
Claude: [creates src/auth/jwt.ts]
Claude: [runs] threadlinking snippet auth_system "Building JWT auth for stateless API"
Claude: [runs] threadlinking attach auth_system src/auth/jwt.ts
```

Once you confirm a thread, Claude uses it automatically for the rest of the session.

Later, when you revisit the code (maybe weeks later, in a new session):

```
You: "Why did we build auth this way?"
Claude: [runs] threadlinking explain src/auth/jwt.ts
Claude: "You chose JWT over sessions because you wanted a stateless API..."
```

---

## Automatic Thread Detection

Claude looks for signals that work should be tracked:

- **Project mentions:** "We're working on myproject" or "This is for client X"
- **Significant new work:** Creating files that represent architectural decisions
- **Explicit requests:** "Remember this" or "Save this context"
- **Design discussions:** Making choices between approaches (REST vs GraphQL, etc.)

When Claude detects these signals, it prompts you to create or use a thread. You stay in control - Claude asks, you confirm.

---

## Cross-Session Context

Threads persist across Claude sessions. One thread accumulates context over the life of a project:

```bash
# Week 1: Starting the project
threadlinking snippet myproject "Building a SaaS for X. Starting with auth."
threadlinking attach myproject src/auth/jwt.ts

# Week 3: New session, same thread
threadlinking snippet myproject "Added API layer. REST for simplicity."
threadlinking attach myproject src/api/routes.ts

# Month 2: Still the same thread
threadlinking snippet myproject "Pivoted to cursor pagination after scale issues"
threadlinking attach myproject src/api/pagination.ts
```

One thread, many sessions, complete context. Works across repos too - the thread lives in `~/.threadlinking/`, not in your project.

---

## Working with Thread Names

Thread names should be project or idea level, not task level. Think `myproject` or `saas_thing`, not `auth_v2` or `fix_bug_123`.

### Set the Current Thread

Tell Claude what you're working on at the start of a session:

```
You: "We're working on myproject today"
Claude: [remembers: current thread = myproject]
Claude: [automatically uses myproject for all context saves]
```

This works automatically with the global CLAUDE.md setup from Quick Start.

### Claude Proposes, User Confirms

Let Claude suggest names based on the work:

```
Claude: "I'll save this context. Thread name: saas_analytics?"
You: "Sure" / "Call it myproject instead"
```

### Discovery First

Don't remember the name? Ask:

```
You: "What threads do I have?"
Claude: [runs] threadlinking list
Claude: "You have: myproject, research_llm, client_acme..."
You: "This is part of myproject"
```

### User Names Explicitly

Take control of the mental model upfront:

```
You: "This project is called 'myproject' - save context as we go"
Claude: [uses myproject for the session]
```

---

## Manual Usage

You can also use threadlinking directly:

```bash
# Save context
threadlinking snippet myproject "Decided on REST for simpler caching"
threadlinking attach myproject src/api/routes.ts

# Find context
threadlinking explain src/api/routes.ts
threadlinking show myproject
threadlinking search "caching"
```

---

## Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `init` | Guided setup for hooks, MCP server, CLAUDE.md |
| `init --status` | Check what's configured without changes |
| `list` | List threads + untracked files |
| `snippet THREAD "text"` | Add context (auto-creates thread) |
| `snippet THREAD "text" --tags a,b` | Add context with tags |
| `attach THREAD file` | Link file to thread |
| `explain file` | Show why this file exists |
| `show THREAD` | View thread with all snippets |
| `show THREAD --tag decision` | Filter snippets by tag |
| `search "query"` | Keyword search across threads |
| `audit` | Check for broken links |
| `list --clear-pending` | Clear untracked files list |

### Semantic Search

Search your threads by meaning, not just keywords:

```bash
# Build the semantic index (run once, then after adding many snippets)
threadlinking reindex

# Search by natural language
threadlinking semantic-search "authentication decisions"
threadlinking semantic-search "why did we choose this database"
```

**How it works:**
- Uses [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) embeddings
- Runs entirely locally via [@xenova/transformers](https://github.com/xenova/transformers.js) (no API calls)
- First run downloads the model (~30MB, cached at `~/.cache/huggingface`)
- Index stored at `~/.threadlinking/semantic_index/`

### Analytics & Export

```bash
# View usage analytics
threadlinking analytics

# Export threads
threadlinking export --format markdown           # All threads as markdown
threadlinking export --format json               # All threads as JSON
threadlinking export --format timeline           # Timeline view
threadlinking export --format markdown myproject # Single thread
```

---

## Data Storage

Everything is stored locally at `~/.threadlinking/thread_index.json`. No cloud, no sync, just a simple JSON file you control.

---

## Security

- All data stored locally at `~/.threadlinking/` with `0600` permissions (owner read/write only)
- No network calls, no telemetry, no cloud sync (model download is one-time and cached)
- Minimal dependencies: [commander](https://www.npmjs.com/package/commander), [@xenova/transformers](https://github.com/xenova/transformers.js), [vectra](https://github.com/Stevenic/vectra)
- Atomic file writes to prevent corruption
- Input sanitization on all user-provided strings

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for upcoming features and ideas.

---

## License

MIT

---

Built by [Marianne](https://github.com/thrialectics)
