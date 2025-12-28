# Threadlink

> Connect your files with their origin stories

Threadlink is a Claude Code native tool for preserving conversation context alongside the files you create.

You're working with Claude on a project. It creates files, makes design decisions, solves problems. A week later, you're looking at the code wondering:

> "What was the context? What was I thinking?"

Threadlink solves this. Claude automatically saves the relevant conversation snippets when creating files, so you can always trace back to the "why."

**The key insight:** A thread is a container for an **idea or project**, not a feature or task. One thread might span months of work, dozens of files, and hundreds of snippets across multiple repos. When you start a new Claude session next week, threadlink connects it back to the earlier conversations - preserving context across the gaps.

---

## Quick Start

**1. Install:**

```bash
npm install -g threadlink
```

**2. Add to your global `~/.claude/CLAUDE.md`:**

```markdown
## Context Preservation

Use threadlink to preserve context across sessions.

Proactively detect when work is thread-worthy:
- User mentions working on a project by name
- Starting significant new work spanning multiple files
- Making architectural decisions that should be remembered
- User asks to "remember this" or "save this context"

When you detect thread-worthy work, prompt the user:
"This looks like work worth preserving context for. Should I create a thread
for this? I'd suggest calling it 'myproject' - or you can name it something else."

Once a thread is confirmed, remember it for the session and use it automatically.

When creating significant files:
- `threadlink snippet THREAD "why this was built this way"`
- `threadlink attach THREAD path/to/file`

Before modifying existing files, check for context:
- `threadlink explain path/to/file`

To discover existing threads:
- `threadlink list`
```

**3. That's it.** Claude detects thread-worthy work and prompts you to create threads.

---

## How It Works

Claude automatically detects when you're doing work worth preserving and prompts you:

```
You: "Let's build a new authentication system using JWT"
Claude: "This looks like work worth preserving context for. Should I create
        a thread for this? I'd suggest 'myproject' - or name it something else."
You: "Call it auth_system"
Claude: [remembers: current thread = auth_system]
Claude: [creates src/auth/jwt.ts]
Claude: [runs] threadlink snippet auth_system "Building JWT auth for stateless API"
Claude: [runs] threadlink attach auth_system src/auth/jwt.ts
```

Once you confirm a thread, Claude uses it automatically for the rest of the session.

Later, when you revisit the code (maybe weeks later, in a new session):

```
You: "Why did we build auth this way?"
Claude: [runs] threadlink explain src/auth/jwt.ts
Claude: "You chose JWT over sessions because you wanted a stateless API..."
```

---

## Automatic Thread Detection

Claude looks for signals that work should be tracked:

- **Project mentions:** "We're working on myproject" or "This is for client X"
- **Significant new work:** Creating files that represent architectural decisions
- **Explicit requests:** "Remember this" or "Save this context"
- **Design discussions:** Making choices between approaches (REST vs GraphQL, etc.)

When Claude detects these signals, it prompts you to create or use a thread. You stay in control - Claude asks, you confirm.

---

## Cross-Session Context

Threads persist across Claude sessions. One thread accumulates context over the life of a project:

```bash
# Week 1: Starting the project
threadlink snippet myproject "Building a SaaS for X. Starting with auth."
threadlink attach myproject src/auth/jwt.ts

# Week 3: New session, same thread
threadlink snippet myproject "Added API layer. REST for simplicity."
threadlink attach myproject src/api/routes.ts

# Month 2: Still the same thread
threadlink snippet myproject "Pivoted to cursor pagination after scale issues"
threadlink attach myproject src/api/pagination.ts
```

One thread, many sessions, complete context. Works across repos too - the thread lives in `~/.threadlink/`, not in your project.

---

## Working with Thread Names

Thread names should be project or idea level, not task level. Think `myproject` or `saas_thing`, not `auth_v2` or `fix_bug_123`.

### Set the Current Thread

Tell Claude what you're working on at the start of a session:

```
You: "We're working on myproject today"
Claude: [remembers: current thread = myproject]
Claude: [automatically uses myproject for all context saves]
```

This works automatically with the global CLAUDE.md setup from Quick Start.

### Claude Proposes, User Confirms

Let Claude suggest names based on the work:

```
Claude: "I'll save this context. Thread name: saas_analytics?"
You: "Sure" / "Call it myproject instead"
```

### Discovery First

Don't remember the name? Ask:

```
You: "What threads do I have?"
Claude: [runs] threadlink list
Claude: "You have: myproject, research_llm, client_acme..."
You: "This is part of myproject"
```

### User Names Explicitly

Take control of the mental model upfront:

```
You: "This project is called 'myproject' - save context as we go"
Claude: [uses myproject for the session]
```

---

## Manual Usage

You can also use threadlink directly:

```bash
# Save context
threadlink snippet myproject "Decided on REST for simpler caching"
threadlink attach myproject src/api/routes.ts

# Find context
threadlink explain src/api/routes.ts
threadlink show myproject
threadlink search "caching"
```

---

## Commands

| Command | Description |
|---------|-------------|
| `snippet THREAD "text"` | Add context (auto-creates thread) |
| `snippet THREAD "text" --tags a,b` | Add context with tags |
| `attach THREAD file` | Link file to thread |
| `explain file` | Show why this file exists |
| `show THREAD` | View thread with all snippets |
| `show THREAD --tag decision` | Filter snippets by tag |
| `search "query"` | Search across threads |
| `list` | List all threads |
| `audit` | Check for broken links |

---

## Data Storage

Everything is stored locally at `~/.threadlink/thread_index.json`. No cloud, no sync, just a simple JSON file you control.

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for upcoming features:
- **v1.x:** Tags for organizing snippets within a thread
- **v2:** Semantic search with embeddings

---

## License

MIT

---

Built by [Marianne](https://github.com/thrialectics)
