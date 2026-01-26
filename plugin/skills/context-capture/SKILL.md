---
name: context-capture
description: Analyze recent work in this session and capture context about what was done and why. Best used after completing a task or making important decisions.
argument-hint: [thread-name]
user-invocable: true
---

Capture the context of recent work for future reference.

## Instructions

1. **Analyze the session**: Review what was accomplished in this conversation:
   - What files were created or modified?
   - What decisions were made?
   - What problems were solved?
   - What trade-offs were considered?

2. **Identify the thread**:
   - Use the thread name from `$ARGUMENTS` if provided
   - Otherwise, infer from the project directory or ask the user

3. **Create a context summary** that captures:
   - WHAT was done (brief factual summary)
   - WHY it was done this way (reasoning, alternatives considered)
   - Any important caveats or follow-up needed

4. **Save to threadlinking**:
   - Call `threadlinking_snippet` with the thread and summary
   - Use appropriate tags: "session-summary", plus relevant domain tags

5. **Link relevant files**:
   - For each significant file created/modified, call `threadlinking_attach`

## Output Format

After saving, confirm:
- Thread name
- Summary of what was captured
- Files linked (if any)

## Example

If the session involved fixing an authentication bug:

```
Captured to thread 'myproject':

Summary: Fixed JWT token refresh bug that caused logout loops. Root cause was
race condition between refresh request and token expiry check. Added mutex
lock around token refresh logic.

Tags: bugfix, auth
Files linked: src/auth/token.ts, src/middleware/auth.ts
```

User input: $ARGUMENTS
