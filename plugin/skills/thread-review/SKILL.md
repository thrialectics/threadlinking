---
name: thread-review
description: Review all context saved to a thread. Shows the history of decisions, changes, and reasoning for a project.
argument-hint: [thread-name]
user-invocable: true
---

Review the full context history of a thread.

## Instructions

1. **Get the thread name** from `$ARGUMENTS`, or ask the user if not provided

2. **Retrieve thread details**:
   - Call `threadlinking_show` with the thread_id
   - This returns all snippets and linked files

3. **Present the context**:
   - Show the thread summary
   - List snippets chronologically with:
     - Date/time
     - Source (where the context came from)
     - Tags
     - Content (the actual context)
   - List all linked files

4. **Offer follow-up actions**:
   - Search for specific topics within the thread
   - Explain why a specific file exists
   - Add new context to the thread

## Output Format

```
## Thread: [thread-name]

**Summary:** [thread summary]
**Created:** [date]
**Snippets:** [count]
**Linked Files:** [count]

---

### Context History

#### [1] [date] via [source]
Tags: [tags]

[content]

---

#### [2] [date] via [source]
...

---

### Linked Files

- `path/to/file1.ts`
- `path/to/file2.ts`
```

User input: $ARGUMENTS
