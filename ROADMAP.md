# Threadlinking Roadmap

## Philosophy

A thread is a container for an **idea or project**, not a feature or task. Threads are long-lived, accumulating context over months of work across many sessions and repos.

The goal: When you ask "why did we build it this way?", the answer should be a command away.

---

## Current State (v2.0.x)

### All Features (Free)
- Thread-based context preservation
- Snippets with source, timestamp, and tags
- File attachments with explain command
- Cross-session, cross-repo persistence
- Keyword search
- Semantic search (local embeddings via @xenova/transformers)
- Analytics (usage stats)
- Export (markdown/JSON/timeline formats)
- MCP server integration with Claude Code
- `.threadlinkingignore` support with prune command
- Guided setup via `threadlinking init`

---

## Phase 1: Publish & CI

**Priority: HIGH**

- [x] Publish v2.0.x to npm
- [x] Set up GitHub Actions CI (ubuntu/macos/windows, Node 20 & 22)
- [ ] Add comprehensive test suite
  - Core operation unit tests
  - Storage layer tests
  - Integration/lifecycle tests
- [ ] Verify Windows compatibility (path separators)

---

## Phase 2: MCP Registry & Discoverability

**Goal:** Make threadlinking discoverable in Claude Code ecosystem

- [ ] Submit to official MCP Registry
- [ ] Add `mcp.json` manifest file
- [x] Create setup instructions for Claude Code users (`threadlinking init`)
- [ ] List on directories: Smithery, Glama, MCP.so
- [ ] Submit PR to awesome-mcp-servers

---

## Phase 3: File-Per-Thread Architecture

Split `thread_index.json` into one file per thread for better concurrency and inspectability.

- [ ] Design migration strategy
- [ ] New `loadThread(id)` / `saveThread(id)` / `updateThread(id, fn)` storage layer
- [ ] Per-thread locking (instead of global lock)
- [ ] Automatic migration from monolithic to file-per-thread
- [ ] Update all operations to use new storage layer

---

## Phase 4: IDE Integration

- [ ] VSCode extension
  - Right-click file → "Show Threadlinking Context"
  - Hover on file → See linked threads
- [ ] Browser extension for ChatGPT/web Claude
- [ ] Claude Desktop Extension (.mcpb) for one-click install

---

## Phase 5: Future Enhancements

- [ ] Thread relationships (link related threads)
- [ ] Context summarization (AI-generated thread summaries)
- [ ] Team/org features (optional, shared threads)
- [ ] Cloud sync (optional, remains local-first by default)
- [ ] Command syntax redesign for power users
- [ ] Flat/nested attribute system

---

## Non-Goals

- Replacing git (threadlinking is "why", git is "what")
- Real-time sync (batch is fine)
- Being the source of truth (supplement, not replace docs)

---

## Contributing

Ideas and PRs welcome. Open an issue to discuss before implementing major features.

---

*Last updated: 2026-03-04*
