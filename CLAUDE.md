# Threadlink

A CLI tool for creating durable, local-first links between AI conversations and the files they produce.

## For Claude Code: Context Preservation

When working on significant files, use threadlink to preserve conversation context. This helps the user (and future Claude sessions) understand where files came from.

## Thread Detection and Prompting

**Proactively detect when a thread should be created.** Look for these signals:

- User mentions working on a project by name ("working on myproject")
- Starting significant new work that will span multiple files
- Making architectural decisions that should be remembered
- User asks to "remember this" or "save this context"
- Creating files that represent important design choices

**When you detect thread-worthy work, prompt the user:**

```
"This looks like work worth preserving context for. Should I create a thread
for this? I'd suggest calling it 'myproject' - or you can name it something else."
```

**If a thread already exists for this project:**
- Check with `threadlink list` to see existing threads
- Ask: "Should this be part of the existing 'myproject' thread?"

**Remember the current thread within a session.** Once the user confirms a thread name, use it for all context saves during that session without asking again.

### When to Save Context

Save a snippet when:
- Creating a new file that resulted from conversation decisions
- Making significant changes based on discussion
- The user asks you to remember why something was built a certain way
- Making a design decision that future sessions should know about

### How to Save Context

```bash
# Add context for a file (auto-creates thread if needed)
threadlink snippet PROJECT_NAME "Relevant excerpt explaining the why"
threadlink attach PROJECT_NAME path/to/file

# Example workflow:
threadlink snippet myproject "User wanted JWT instead of sessions for stateless API" --tags auth,decision
threadlink attach myproject src/auth/jwt.ts
```

### Thread Naming

Threads should be **project or idea level**, not task level:
- Good: `myproject`, `saas_analytics`, `client_acme`
- Avoid: `auth_v2`, `fix_bug_123`, `refactor_api`

One thread can span months of work, dozens of files, and hundreds of snippets. Use tags (`--tags decision,auth`) to organize within a thread.

### Checking Existing Context

```bash
# Before modifying a file, check if it has context
threadlink explain path/to/file

# Search for related threads
threadlink search "keyword"
```

---

## CLI Reference

### Core Operations
```bash
threadlink snippet THREAD "content"   # Add context (auto-creates thread)
threadlink attach THREAD path/to/file # Link file to thread
threadlink detach THREAD path/to/file # Unlink file
threadlink show THREAD                # View thread details
threadlink list                       # List all threads
```

### Looking Up Context
```bash
threadlink explain path/to/file       # Why does this file exist?
threadlink search "keyword"           # Search threads
```

### Maintenance
```bash
threadlink update THREAD --summary "new summary"
threadlink rename OLD_ID NEW_ID
threadlink delete THREAD
threadlink audit                      # Check for broken links
```

## Data Storage

Threads stored as JSON in `~/.threadlink/thread_index.json`:
- Thread IDs (human-readable tags)
- Snippets (conversation excerpts with source and timestamp)
- Linked files (local paths)
- Metadata (summaries, creation/modification dates)
