# Threadlink

> Connect your files with their origin stories

Threadlink is a CLI tool for creating durable, local-first links between AI conversations and the files they produce.

You have a conversation with Claude or ChatGPT. It leads to a document, a design, some code. Two weeks later, you're looking at the file and wondering:

> "What was the context? What was I thinking?"

Threadlink solves this by maintaining a simple index that connects your files back to their source conversations - including the actual conversation snippets that explain why things were built a certain way.

---

## Installation

```bash
npm install -g threadlink
```

Or run directly with npx:

```bash
npx threadlink --help
```

Requires Node.js 18+.

---

## Basic Usage

**Save context when you create files:**

```bash
# Add a snippet explaining why (auto-creates thread if needed)
threadlink snippet api_design "User wanted REST instead of GraphQL for simpler caching"
threadlink attach api_design ~/Documents/api_spec.md

# Add more context from later conversations
threadlink snippet api_design "Decided on cursor-based pagination after discussing tradeoffs"
```

**Find context later:**

```bash
# What was I thinking when I made this?
threadlink explain ~/Documents/api_spec.md

# Show thread with all snippets
threadlink show api_design

# Search across threads
threadlink search "pagination"
```

---

## Commands

### Adding context

```bash
threadlink snippet THREAD "context"              # Add snippet (auto-creates thread)
threadlink snippet THREAD "context" --source X   # Specify source (claude-code, chatgpt, etc)
threadlink snippet THREAD --file notes.txt       # Read snippet from file
threadlink attach THREAD path/to/file            # Link a file to thread
threadlink detach THREAD path/to/file            # Unlink a file
```

### Finding context

```bash
threadlink explain path/to/file             # Show context for a file (with snippets)
threadlink show THREAD                      # View thread details and snippets
threadlink search "keyword"                 # Search threads by keyword
threadlink list                             # List all threads
threadlink list --prefix "api"              # Filter by prefix
threadlink list --since 30                  # Threads from last 30 days
```

### Maintaining threads

```bash
threadlink update THREAD --summary "new"    # Update summary
threadlink rename OLD_ID NEW_ID             # Rename a thread
threadlink delete THREAD                    # Delete (with confirmation)
threadlink audit                            # Check for broken links
threadlink clear                            # Delete all (use carefully)
```

---

## How It Works

Threadlink stores everything in a single JSON file at `~/.threadlink/thread_index.json`:

| Field | Description |
|-------|-------------|
| Thread ID | Human-readable tag (e.g., `api_design`) |
| Summary | What the thread is about |
| Snippets | Conversation excerpts with source and timestamp |
| Linked Files | Local file paths connected to this thread |
| Timestamps | When created and last modified |

No cloud. No sync. Just a local index you control.

---

## Use Cases

**"What was I thinking when I made this?"**

```bash
threadlink explain ~/Projects/auth_module.py
# Shows the conversation snippets that led to this design
```

**"I need to pick up where I left off"**

```bash
threadlink show auth_redesign
# See all context snippets and linked files for this thread
```

**"Check my thread hygiene"**

```bash
threadlink audit
# Reports broken file links, orphan threads, stale entries
```

---

## License

MIT

---

## Philosophy

> Threadlink bridges the gap between ephemeral conversation and persistent artifact. When you ask "why did I build it this way?", the answer should be a command away.

---

Built by [Marianne](https://github.com/thrialectics)
