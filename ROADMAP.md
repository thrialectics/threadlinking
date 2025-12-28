# Threadlink Roadmap

## Philosophy

A thread is a container for an **idea or project**, not a feature or task. Threads are long-lived, accumulating context over months of work across many sessions and repos.

The goal: When you ask "why did we build it this way?", the answer should be a command away.

---

## Current (v1.0)

- Thread-based context preservation
- Snippets with source and timestamp
- File attachments
- Cross-session, cross-repo persistence
- Basic keyword search

---

## Near-term (v1.x)

### Tags for Organization

Snippets can be tagged for organization within a thread:

```bash
threadlink snippet myproject "Chose JWT for stateless API" --tags auth,decision
threadlink snippet myproject "Fixed token refresh bug" --tags auth,bugfix

# Filter by tag
threadlink show myproject --tag decision
threadlink show myproject --tag auth
```

Suggested tag conventions:
- `decision` - Why we chose X over Y
- `bugfix` - What broke and how we fixed it
- `exploration` - Early thinking, may not be final
- Domain tags: `auth`, `api`, `frontend`, etc.

### Thread Metadata

```bash
# Set thread-level metadata
threadlink update myproject --description "Main SaaS product development"

# See thread stats
threadlink show myproject --stats
# Output: 47 snippets, 23 files, last updated 2 days ago
```

---

## Future (v2)

### Semantic Search

Instead of keyword matching, find context by meaning:

```bash
threadlink search "why did we choose this architecture" --thread myproject
```

Uses embeddings to find the most relevant snippets, even if they don't contain the exact words.

Implementation options:
- Local embeddings (e.g., `transformers.js`)
- API-based (OpenAI, Anthropic)
- Hybrid: local index with API fallback

### Thread Relationships

Link related threads:

```bash
threadlink link myproject client_acme
# Now context flows between them
```

### Context Summarization

Auto-generate summaries of long threads:

```bash
threadlink summarize myproject
# Output: AI-generated summary of key decisions and evolution
```

### IDE Integration

- VSCode extension: Right-click file → "Show Threadlink Context"
- Hover on file in explorer → See linked threads

### MCP Server

Native Claude integration without CLI:

```typescript
// Claude calls this directly
threadlink_save_context({
  thread: "myproject",
  snippet: "User chose JWT for stateless API",
  files: ["src/auth/jwt.ts"],
  tags: ["auth", "decision"]
})
```

---

## Non-Goals

- Cloud sync (local-first is a feature, not a limitation)
- Team collaboration (this is personal context, not shared docs)
- Real-time updates (batch is fine)

---

## Contributing

Ideas and PRs welcome. Open an issue to discuss before implementing major features.
