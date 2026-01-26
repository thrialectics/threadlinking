---
description: Show why a file exists - its origin story from threadlinking
---

# /explain

Show the origin story and context for a file.

## Usage

`/explain <file>`

## Arguments

- `file` - Path to the file to explain

## Examples

```
/explain src/auth/jwt.ts
/explain package.json
```

## Instructions

When this command is invoked:

1. Use the `threadlinking_explain` MCP tool:
   - `file_path`: the file argument (resolve to absolute if relative)

2. Present the results showing:
   - Which thread(s) the file is linked to
   - Related snippets explaining decisions
   - When the context was saved

3. If no context exists for the file, suggest:
   - Creating a thread with `/threadlink`
   - Or attaching it to an existing thread
