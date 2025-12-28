# Threadlink

> Connect your files with their origin stories

Threadlink is a Claude Code native tool for preserving conversation context alongside the files you create.

You're working with Claude on a project. It creates files, makes design decisions, solves problems. A week later, you're looking at the code wondering:

> "What was the context? What was I thinking?"

Threadlink solves this. Claude automatically saves the relevant conversation snippets when creating files, so you can always trace back to the "why."

**The key insight:** A thread is a container for an idea or project that spans multiple sessions and even multiple repos. When you start a new Claude session next week, threadlink connects it back to the earlier conversations - preserving context across the gaps.

---

## Quick Start

**1. Install:**

```bash
npm install -g threadlink
```

**2. Add to your project's CLAUDE.md:**

```markdown
## Context Preservation

Use threadlink to preserve context across sessions.

When the user specifies a thread (e.g., "we're working on X"), remember it
and use that thread name for all threadlink operations in this session.

When creating significant files:
- `threadlink snippet THREAD "why this was built this way"`
- `threadlink attach THREAD path/to/file`

Before modifying existing files, check for context:
- `threadlink explain path/to/file`

To discover existing threads:
- `threadlink list`
```

**3. That's it.** Tell Claude what thread you're working on, and it handles the rest.

---

## How It Works

When you're working with Claude and it creates a file:

```
You: "Let's use JWT instead of sessions for auth"
Claude: [creates src/auth/jwt.ts]
Claude: [runs] threadlink snippet auth_design "User chose JWT over sessions for stateless API"
Claude: [runs] threadlink attach auth_design src/auth/jwt.ts
```

Later, when you revisit the code:

```
You: "Why did we build auth this way?"
Claude: [runs] threadlink explain src/auth/jwt.ts
Claude: "You chose JWT over sessions because you wanted a stateless API..."
```

---

## Cross-Session Context

Threads persist across Claude sessions. Start a conversation today, pick it up next week:

```bash
# Session 1 (today): Working on auth
threadlink snippet auth_v2 "Migrating from sessions to JWT for mobile support"
threadlink attach auth_v2 src/auth/jwt.ts

# Session 2 (next week): New Claude session, same thread
threadlink snippet auth_v2 "Added refresh token rotation after security review"
threadlink attach auth_v2 src/auth/refresh.ts
```

One thread, multiple sessions, complete context. Works across repos too - the thread lives in `~/.threadlink/`, not in your project.

---

## Working with Thread Names

Thread names are like branch names - they need to be meaningful enough to find later. There are several ways to work with them:

### Set the Current Thread

Tell Claude what you're working on at the start of a session:

```
You: "We're continuing work on auth_v2 today"
Claude: [remembers: current thread = auth_v2]
Claude: [automatically uses auth_v2 for all context saves]
```

Add this to your CLAUDE.md to enable this pattern:

```markdown
When the user specifies a thread (e.g., "we're working on X"), use that
thread name for all threadlink operations in this session.
```

### Claude Proposes, User Confirms

Let Claude suggest names based on the work:

```
Claude: "I'll save this context. Thread name: auth_jwt_migration?"
You: "Sure" / "Call it auth_v2 instead"
```

### Discovery First

Don't remember the name? Ask:

```
You: "What threads do I have?"
Claude: [runs] threadlink list
Claude: "You have: auth_v2, api_redesign, mobile_app..."
You: "Add this to auth_v2"
```

### User Names Explicitly

Take control of the mental model upfront:

```
You: "Let's call this work 'auth_v2' - save context as we go"
Claude: [uses auth_v2 for the session]
```

---

## Manual Usage

You can also use threadlink directly:

```bash
# Save context
threadlink snippet api_design "Decided on REST for simpler caching"
threadlink attach api_design src/api/routes.ts

# Find context
threadlink explain src/api/routes.ts
threadlink show api_design
threadlink search "caching"
```

---

## Commands

| Command | Description |
|---------|-------------|
| `snippet THREAD "text"` | Add context (auto-creates thread) |
| `attach THREAD file` | Link file to thread |
| `explain file` | Show why this file exists |
| `show THREAD` | View thread with all snippets |
| `search "query"` | Search across threads |
| `list` | List all threads |
| `audit` | Check for broken links |

---

## Data Storage

Everything is stored locally at `~/.threadlink/thread_index.json`. No cloud, no sync, just a simple JSON file you control.

---

## License

MIT

---

Built by [Marianne](https://github.com/thrialectics)
