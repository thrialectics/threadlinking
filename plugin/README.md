# Threadlinking Plugin for Claude Code

Git tracks what changed. Threadlinking tracks **why**.

Preserve AI conversation context across sessions. Connect files with their origin stories.

## Installation

### From Marketplace (Recommended)

```bash
/plugin marketplace add thrialectics/threadlinking
/plugin install threadlinking@thrialectics
```

### From Local Directory

```bash
claude --plugin-dir /path/to/threadlinking/plugin
```

## Skills (Slash Commands)

| Command | Description |
|---------|-------------|
| `/save-context [thread] [context]` | Save a decision or reasoning to a thread |
| `/context-capture [thread]` | Analyze the session and capture what was done |
| `/thread-review [thread]` | Review all context for a thread |
| `/find-context [query]` | Search threads by meaning (semantic search) |
| `/explain-file [path]` | Show why a file exists |
| `/thread-stats` | View analytics and usage insights |

### Example Usage

```
/save-context myproject Chose PostgreSQL over MongoDB for ACID transactions
/context-capture myproject
/thread-review myproject
/find-context "why did we choose this architecture"
/explain-file src/db/config.ts
/thread-stats
```

## Hooks (Automatic)

- **SessionEnd**: Prompts to save context when ending a significant work session

## MCP Tools

The plugin bundles the threadlinking MCP server with these tools:

### Core Tools
- `threadlinking_snippet` - Add context to a thread
- `threadlinking_attach` - Link a file to a thread
- `threadlinking_detach` - Unlink a file
- `threadlinking_explain` - Show file's origin story
- `threadlinking_show` - View thread details
- `threadlinking_list` - List all threads
- `threadlinking_search` - Keyword search
- `threadlinking_create` - Create a new thread

### Advanced Tools
- `threadlinking_semantic_search` - Search by meaning
- `threadlinking_analytics` - Usage insights
- `threadlinking_export` - Export threads (markdown, JSON, timeline)

## Quick Start

1. Install the plugin
2. Start working on a project
3. When you make a decision or complete a task, use `/save-context`:

```
/save-context myproject Chose React Query over Redux because we only need server state management
```

4. Later, review your context:

```
/thread-review myproject
```

5. Find related decisions:

```
/find-context "state management decisions"
```

6. Understand why a file exists:

```
/explain-file src/api/queries.ts
```

## Thread Naming

Use project names, not task names:
- Good: `myproject`, `saas-app`, `client-acme`
- Bad: `fix-bug-123`, `auth-v2`

Threads are long-lived containers that accumulate context over time.

## Data Storage

All data is stored locally:
- `~/.threadlinking/thread_index.json` - All threads and snippets
- `~/.threadlinking/semantic_index/` - Semantic search index
- `~/.threadlinking/pending_files.json` - Tracked but unlinked files

No cloud sync, no telemetry. You own your context.

## Documentation

- [GitHub Repository](https://github.com/thrialectics/threadlinking)
- [MCP Server Documentation](https://github.com/thrialectics/threadlinking#mcp-server)

## License

MIT
