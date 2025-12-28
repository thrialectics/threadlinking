# Threadlink

A CLI tool for creating durable, local-first links between AI conversations and the files they produce.

## For Claude Code: Context Preservation

When working on significant files, use threadlink to preserve conversation context. This helps the user (and future Claude sessions) understand where files came from.

### When to Save Context

Save a snippet when:
- Creating a new file that resulted from conversation decisions
- Making significant changes based on discussion
- The user asks you to remember why something was built a certain way

### How to Save Context

```bash
# Add context for a file (auto-creates thread if needed)
threadlink snippet PROJECT_NAME "Relevant excerpt explaining the why"
threadlink attach PROJECT_NAME path/to/file

# Example workflow:
threadlink snippet auth_redesign "User wanted JWT instead of sessions for stateless API" --source claude-code
threadlink attach auth_redesign src/auth/jwt.py
```

### Thread Naming

Propose descriptive thread names to the user:
- Use lowercase with underscores: `auth_redesign`, `api_v2_migration`
- Keep them short but meaningful
- If user has a preference, use their name exactly

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
