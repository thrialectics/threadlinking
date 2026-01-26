---
name: explain-file
description: Show why a file exists - its origin story and the decisions that led to its creation.
argument-hint: [file-path]
user-invocable: true
---

Explain the origin and context behind a file.

## Instructions

1. **Get the file path** from `$ARGUMENTS`
   - If not provided, ask the user which file to explain
   - Accept relative or absolute paths

2. **Call threadlinking_explain** with the file path

3. **Present the explanation**:
   - Which thread(s) the file is linked to
   - The context snippets that mention or relate to this file
   - When it was first linked and by whom

4. **If no context found**:
   - Inform the user the file isn't linked to any threads
   - Offer to link it now: "Would you like to link this file to a thread?"

## Output Format

```
## File: [file-path]

**Linked to thread:** [thread-name]

### Why this file exists

[Relevant context snippets explaining the file's purpose]

### Timeline

- [date]: File first linked to [thread]
- [date]: [relevant context added]

### Related Files

- `other/related/file.ts` (same thread)
```

User input: $ARGUMENTS
