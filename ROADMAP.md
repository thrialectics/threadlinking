# Threadlinking Roadmap

## Philosophy

A thread is a container for an **idea or project**, not a feature or task. Threads are long-lived, accumulating context over months of work across many sessions and repos.

The goal: When you ask "why did we build it this way?", the answer should be a command away.

---

## Current State (v2.0.0)

### Version Status
- **GitHub**: v2.0.0 (main branch)
- **npm**: v1.1.1 (needs publishing)

### All Features (Free)
- Thread-based context preservation
- Snippets with source, timestamp, and tags
- File attachments with explain command
- Cross-session, cross-repo persistence
- Keyword search
- Semantic search (local embeddings via wink-nlp)
- Analytics (usage stats)
- Export (markdown/JSON/timeline formats)
- MCP server integration with Claude Code

---

## Phase 1: Publish v2.0.0 to npm

**Priority: HIGH**

The main blocker for wider adoption.

- [ ] Add basic test suite
  - Core: thread CRUD, snippet operations
  - CLI: smoke tests for main commands
- [ ] Set up GitHub Actions CI
  - Run tests on push
  - Lint check
  - Build verification
- [ ] Update README with v2.0 features
- [ ] Verify Windows compatibility (path separators)
- [ ] **Publish v2.0.0 to npm**

---

## Phase 2: MCP Registry & Discoverability

**Goal:** Make threadlinking discoverable in Claude Code ecosystem

- [ ] Submit to official MCP Registry
- [ ] Add `mcp.json` manifest file
- [ ] Create setup instructions for Claude Code users
  - **Recommend `~/.claude/mcp.json`** (dedicated MCP config, not settings.json)
  - Document the difference: mcp.json is for MCP servers only, settings.json mixes personal config
  - Provide simple copy-paste config:
    ```json
    {
      "mcpServers": {
        "threadlinking": {
          "command": "npx",
          "args": ["threadlinking-mcp"]
        }
      }
    }
    ```
  - Note: Users can also use settings.json → mcpServers if they prefer single-file config
- [ ] List on directories: Smithery, Glama, MCP.so
- [ ] Submit PR to awesome-mcp-servers

---

## Phase 3: IDE Integration

- [ ] VSCode extension
  - Right-click file → "Show Threadlinking Context"
  - Hover on file → See linked threads
- [ ] Browser extension for ChatGPT/web Claude
- [ ] Claude Desktop Extension (.mcpb) for one-click install

---

## Phase 4: Future Enhancements

- [ ] Thread relationships (link related threads)
- [ ] Context summarization (AI-generated thread summaries)
- [ ] Team/org features (optional, shared threads)
- [ ] Cloud sync (optional, remains local-first by default)

---

## Non-Goals

- Replacing git (threadlinking is "why", git is "what")
- Real-time sync (batch is fine)
- Being the source of truth (supplement, not replace docs)

---

## Contributing

Ideas and PRs welcome. Open an issue to discuss before implementing major features.

---

*Last updated: 2026-01-24*
