# Threadlinking

Git tracks what changed. Threadlinking tracks **why**.

A local-first tool for preserving AI conversation context alongside the files you create. When you return to code weeks later, threadlinking tells you the reasoning behind it.

---

## Session Protocol

### Starting a Session

1. **Check existing threads:** `threadlinking list`
2. **If resuming work:** Note the relevant thread name for this session
3. **For unfamiliar code:** Use `threadlinking explain path/to/file` before modifying

### During a Session

- **Before modifying significant files:** `threadlinking explain path/to/file`
- **When making decisions:** `threadlinking snippet THREAD "why we chose X over Y"`
- **When creating files:** `threadlinking attach THREAD path/to/file`
- **Finding related context:** `threadlinking semantic-search "what you're looking for"`

### Ending a Session

For significant work sessions, offer to capture what was accomplished:
- Summarize key decisions made
- Save snippets for important reasoning
- Attach any new files to the appropriate thread

---

## Thread Detection

**Proactively detect when context should be saved.** Look for:

- User mentions a project name ("working on myproject")
- Significant new work spanning multiple files
- Architectural decisions ("let's use PostgreSQL because...")
- User asks to "remember this" or "save this context"
- Design choices that future sessions should know about
- Trade-off discussions ("we could do X or Y, let's go with X because...")

**When detected, prompt:**
```
"This looks like context worth preserving. Should I save it to a thread?
I'd suggest 'myproject' - or name it something else."
```

**If a thread might exist:** Check `threadlinking list` first, then ask:
```
"Should this be part of the existing 'myproject' thread?"
```

**Remember the thread for the session.** Once confirmed, use it for all context saves without asking again.

---

## What to Save

### Good Snippets (Save These)

- **Decisions:** "Chose JWT over sessions for stateless API scaling"
- **Trade-offs:** "Picked PostgreSQL over MongoDB - need ACID for payments"
- **Constraints:** "Must support offline mode, so local-first architecture"
- **Pivots:** "Switched from REST to GraphQL after N+1 query issues"
- **Architecture:** "Event sourcing pattern for audit trail requirements"

### Poor Snippets (Don't Bother)

- "Fixed typo in README"
- "Updated dependencies"
- "Refactored for readability"
- Implementation details without reasoning

**Rule of thumb:** If someone asks "why?" in 6 months, will this snippet answer them?

---

## Searching Context

### Keyword Search
```bash
threadlinking search "authentication"
```
Fast, exact matches. Use when you know specific terms.

### Semantic Search
```bash
threadlinking semantic-search "why did we structure the database this way"
threadlinking semantic-search "decisions about user authentication"
```
Searches by meaning. Use when exploring or asking conceptual questions.

**First time:** Run `threadlinking reindex` to build the semantic index (downloads ~30MB model, cached locally).

**Keep index fresh:** Run `threadlinking reindex` periodically if you've added many snippets.

---

## Thread Naming

Threads are **projects or ideas**, not tasks:

| Good | Bad |
|------|-----|
| `myproject` | `fix-bug-123` |
| `saas-analytics` | `auth-v2` |
| `client-acme` | `refactor-api` |

One thread spans months of work, dozens of files, hundreds of snippets. Use tags to organize within:
```bash
threadlinking snippet myproject "Chose Redis for sessions" --tags auth,infrastructure,decision
```

---

## CLI Reference

### Core Commands
```bash
threadlinking list                        # See all threads + pending files
threadlinking snippet THREAD "context"    # Save reasoning (auto-creates thread)
threadlinking attach THREAD path/to/file  # Link file to thread
threadlinking detach THREAD path/to/file  # Unlink file
threadlinking explain path/to/file        # Why does this file exist?
threadlinking show THREAD                 # View thread with all snippets
threadlinking show THREAD --tag decision  # Filter by tag
```

### Search
```bash
threadlinking search "keyword"            # Keyword search
threadlinking semantic-search "concept"   # Meaning-based search
threadlinking reindex                     # Rebuild semantic index
```

### Analytics & Export
```bash
threadlinking analytics                   # Usage stats and insights
threadlinking export --format markdown    # Export all as markdown
threadlinking export --format json        # Export all as JSON
threadlinking export --format timeline    # Chronological view
threadlinking export --format markdown THREAD  # Export single thread
```

### Maintenance
```bash
threadlinking update THREAD --summary "description"
threadlinking rename OLD_NAME NEW_NAME
threadlinking delete THREAD
threadlinking audit                       # Find broken file links
threadlinking list --clear-pending        # Clear pending files list
```

---

## Workflow Examples

### Starting a New Project
```
User: "Let's build a new API for user management"
Claude: [checks] threadlinking list
Claude: "I don't see an existing thread for this. Should I create one?
        I'd suggest 'user-api' - or name it something else."
User: "Call it backend-services"
Claude: [remembers thread = backend-services for session]
Claude: [creates files]
Claude: [runs] threadlinking snippet backend-services "Starting user management API.
        REST endpoints for CRUD operations, JWT auth, PostgreSQL storage."
Claude: [runs] threadlinking attach backend-services src/api/users.ts
```

### Returning to Existing Code
```
User: "Why is the auth middleware structured this way?"
Claude: [runs] threadlinking explain src/middleware/auth.ts
Claude: "According to the thread, this was built with offline-first in mind.
        The token validation happens locally to avoid network dependency..."
```

### Exploring Related Decisions
```
User: "What decisions did we make about caching?"
Claude: [runs] threadlinking semantic-search "caching strategy decisions"
Claude: "Found 3 relevant threads:
        - backend-services: 'Added Redis for session caching after load testing'
        - client-app: 'Using stale-while-revalidate for API responses'
        - infrastructure: 'CDN caching rules for static assets'"
```

### Session Wrap-up
```
Claude: "We accomplished a lot this session. Want me to capture the context?
        Key decisions:
        - Switched from polling to WebSockets for real-time updates
        - Added rate limiting at 100 req/min per user
        - Chose bull queue for background jobs"
User: "Yes, save that"
Claude: [runs] threadlinking snippet backend-services "Session: Added real-time updates
        via WebSockets (replaced polling for lower latency). Rate limiting at 100/min.
        Bull queue for async jobs." --tags session-summary,architecture
```

---

## Data Storage

All data is local:
- **Threads:** `~/.threadlinking/thread_index.json`
- **Semantic index:** `~/.threadlinking/semantic_index/`
- **Pending files:** `~/.threadlinking/pending_files.json`

No cloud sync, no telemetry. You own your context.
