---
name: threadlinking
description: Preserve conversation context across sessions by linking files to their origin stories
alwaysApply: false
---

# threadlinking Skill

You have access to threadlinking - a system for preserving context across sessions.

## Core Concept

Every file has an origin story. Threadlinking captures *why* code exists, not just *what* it does. This context persists across sessions, so future conversations can understand past decisions.

## When to Use Threadlinking

### Proactively save context when:

1. **Creating new files** from conversation decisions
2. **Making architectural choices** that future sessions should know
3. **User asks to "remember why"** something was done
4. **Significant work spanning multiple files** that forms a coherent project

### Prompt the user when you detect thread-worthy work:

> "This looks like work worth preserving. Should I save this context to a thread called 'projectname'?"

Once confirmed, **remember the thread name for the session** and use it automatically.

## Available MCP Tools

| Tool | Purpose |
|------|---------|
| `threadlinking_snippet` | Save context to a thread |
| `threadlinking_attach` | Link a file to a thread |
| `threadlinking_detach` | Unlink a file from a thread |
| `threadlinking_explain` | Show why a file exists |
| `threadlinking_show` | View full thread details |
| `threadlinking_list` | List all threads + pending files |
| `threadlinking_search` | Keyword search |
| `threadlinking_semantic_search` | Find context by meaning |
| `threadlinking_analytics` | Usage insights |
| `threadlinking_export` | Export threads (markdown, JSON, timeline) |

## Best Practices

### Thread Naming

Threads should be **project-level**, not task-level:

- **Good**: `myproject`, `api-v2`, `client-acme`, `experiments`
- **Bad**: `fix-bug-123`, `refactor-auth`, `add-button`

One thread can span months of work and dozens of files.

### What to Save

Focus on **decisions and reasoning**, not actions:

- **Good**: "Chose PostgreSQL for ACID compliance and complex queries"
- **Bad**: "Created database.ts"

- **Good**: "Using JWT instead of sessions for stateless horizontal scaling"
- **Bad**: "Added jwt.ts file"

### Workflow

1. **At session start**: Run `threadlinking_list` to see active threads and pending files
2. **Before modifying unknown files**: Use `threadlinking_explain` to check for context
3. **After creating files from decisions**: Use `threadlinking_snippet` + `threadlinking_attach`
4. **Use tags** to organize within threads: `--tags auth,decision`

## Session Protocol

When starting a session:

1. Check if there are pending files that need context
2. Ask about any files the user wants to work on
3. Look up context before modifying existing files

When ending significant work:

1. Save key decisions as snippets
2. Attach any new files to the appropriate thread
3. Use descriptive tags for easy searching later

## Slash Commands

Users can also use these shortcuts:

- `/threadlink <thread> "content" [file]` - Save and optionally attach
- `/explain <file>` - Show file's origin story
- `/context [thread]` - List threads or show details
