---
description: List all threadlinking threads or show details of a specific thread
---

# /context

List threads or show thread details.

## Usage

`/context [thread]`

## Arguments

- `thread` (optional) - Thread name to show details for

## Examples

```
/context                    # List all threads
/context myproject          # Show details for myproject thread
```

## Instructions

When this command is invoked:

### Without arguments (list all threads)

1. Use the `threadlinking_list` MCP tool
2. Present the results showing:
   - Thread names
   - Number of snippets in each
   - Number of linked files
   - Any pending files not yet linked

### With a thread argument (show details)

1. Use the `threadlinking_show` MCP tool:
   - `thread_id`: the thread argument

2. Present the results showing:
   - Thread summary
   - All snippets with timestamps
   - All linked files
   - Related URLs if any
