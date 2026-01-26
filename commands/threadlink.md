---
description: Save context snippet to a threadlinking thread and optionally attach a file
---

# /threadlink

Save decision context and optionally link a file to a thread.

## Usage

`/threadlink <thread> "content" [file]`

## Arguments

- `thread` - Thread name (project-level, e.g., "myproject")
- `content` - Context to save (focus on the "why")
- `file` (optional) - File path to attach to the thread

## Examples

```
/threadlink myproject "Chose JWT for stateless auth"
/threadlink api-v2 "Added rate limiting for security" src/middleware/ratelimit.ts
```

## Instructions

When this command is invoked:

1. Use the `threadlinking_snippet` MCP tool to save the content:
   - `thread_id`: the thread argument
   - `content`: the quoted content
   - `source`: "claude-code"

2. If a file path was provided, also use `threadlinking_attach`:
   - `thread_id`: the thread argument
   - `file_path`: the file path (resolve to absolute if relative)

3. Confirm what was saved and attached.

## Thread Naming

Threads should be project-level, not task-level:
- Good: `myproject`, `api-v2`, `client-acme`
- Bad: `fix-bug-123`, `refactor-auth`
