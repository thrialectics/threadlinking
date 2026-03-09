---
title: "refactor: Storage correctness, performance, and MCP completeness"
type: refactor
status: active
date: 2026-03-09
---

# Storage Correctness, Performance, and MCP Completeness

## Overview

Address five issues identified in code review: a lock ordering violation that risks deadlock, a performance bottleneck where `list` loads all thread files, a missing `reindex` MCP tool, unnecessary full-index loads in semantic search, and silent error swallowing in the `track` hook.

## Problem Statement

1. **Lock ordering deadlock** — `updateThread()` acquires a per-thread lock, then calls `updateMetaIndex()` which acquires the meta lock. If another process holds the meta lock and needs a thread lock, classic deadlock. The 10s stale timeout makes this non-fatal but causes operation failures.

2. **`list` loads all thread files** — `listThreads()` calls `loadAllThreads()` just to count snippets and files per thread. At 50+ threads this becomes a noticeable disk I/O bottleneck. The meta index only stores summary and dates — not counts.

3. **No `reindex` MCP tool** — Users working exclusively through Claude Code's MCP interface can't trigger a semantic index rebuild. The semantic search tells them to run `threadlinking reindex` but they have no way to do it from MCP.

4. **`semanticSearch` loads full index** — Every semantic search reads all thread files via `loadIndex()` just to resolve thread metadata for results. Could use the lightweight meta index instead.

5. **`track` swallows all errors** — The hook's `catch {}` means a corrupted `pending.json` silently stops tracking files until someone notices.

## Technical Approach

### Architecture

The fix centers on `src/core/storage.ts`. The key insight: **move the meta index update outside the thread lock** in `updateThread()`. This eliminates the nested lock acquisition that causes deadlock risk, and naturally leads to enriching the meta index with counts (since we need the meta update to be self-contained).

### Implementation Phases

#### Phase 1: Fix Lock Ordering (Correctness)

**Goal:** Eliminate deadlock risk by ensuring no function holds two locks simultaneously.

**Approach:** In `updateThread()`, release the thread lock *before* calling `updateMetaIndex()`. The thread file is already written atomically at that point — the meta update is a best-effort sync of metadata.

**Tasks:**

- [ ] `src/core/storage.ts` — Restructure `updateThread()`:
  1. Acquire thread lock
  2. Load, mutate, atomicWrite thread file
  3. Capture the updated thread data
  4. Release thread lock
  5. Call `updateMetaIndex()` (now outside thread lock)
  - The try/finally block needs restructuring — release must happen before the meta call
- [ ] `src/core/storage.ts` — Audit `saveThread()`:
  - Currently: atomicWrite thread (no lock) → updateMetaIndex
  - This is fine (only one lock), but document the ordering
- [ ] `src/core/operations/relate.ts` — Fix sequential `updateThread` calls:
  - Sort thread IDs alphabetically before acquiring locks to prevent A→B vs B→A deadlock
  - After Phase 1's `updateThread` fix, each call only holds one lock at a time, so this becomes less critical — but deterministic ordering is still good practice
- [ ] `src/commands/rename.ts` — Audit sequential `saveThread` + `deleteThreadFile`:
  - Both only acquire meta lock — no deadlock risk, but document
- [ ] `src/commands/clear.ts` — Audit loop of `deleteThreadFile`:
  - Sequential meta locks — no deadlock, but contention. Consider batching into single meta update
- [ ] Add doc comment to `updateThread()` explaining lock ordering contract
- [ ] Add doc comment to `updateMetaIndex()` explaining it must never be called while holding a thread lock (enforced by design after this change)

**Tests:**

- [ ] `tests/operations.test.ts` — Add concurrency test: two `addSnippet` calls to different threads in parallel should both succeed
- [ ] `tests/operations.test.ts` — Add concurrency test: `addSnippet` + `listThreads` in parallel should not deadlock
- [ ] `tests/operations.test.ts` — Verify `relateThreads(a, b)` and `relateThreads(b, a)` produce same result (deterministic ordering)

**Risk:** Brief window between thread write and meta update where they're inconsistent. This is acceptable because:
- Meta index is advisory (listing/display only)
- Thread file is the source of truth
- `loadAllThreads()` doesn't use meta index
- Worst case: a `list` shows stale count for <1 second

**Files:** `src/core/storage.ts`, `src/core/operations/relate.ts`, `tests/operations.test.ts`

---

#### Phase 2: Meta Index Carries Counts (Performance)

**Goal:** Eliminate `loadAllThreads()` from `list` by storing counts in the meta index.

**Approach:** Enrich `ThreadMeta` with `snippetCount` and `fileCount`. Update `extractMeta()` to include them. The meta index stays small (two extra numbers per thread) but removes the need to load full thread files for listing.

**Tasks:**

- [ ] `src/core/storage.ts` — Add to `ThreadMeta` interface:
  ```typescript
  export interface ThreadMeta {
    summary: string;
    date_created: string;
    date_modified?: string;
    snippetCount?: number;  // Optional for backward compat with existing index.json
    fileCount?: number;
  }
  ```
- [ ] `src/core/storage.ts` — Update `extractMeta()`:
  ```typescript
  function extractMeta(thread: Thread): ThreadMeta {
    return {
      summary: thread.summary,
      date_created: thread.date_created,
      date_modified: thread.date_modified,
      snippetCount: (thread.snippets || []).length,
      fileCount: (thread.linked_files || []).length,
    };
  }
  ```
- [ ] `src/core/operations/list.ts` — Remove `loadAllThreads()` call:
  - Use `meta.threads[id].snippetCount ?? 0` instead of loading full thread
  - For the `allLinkedFiles` set (used to filter pending), fall back to `loadAllThreads()` only if any meta entry lacks `fileCount` (migration path)
  - Alternatively: track linked files in a separate lightweight structure (future optimization)
- [ ] `src/core/operations/list.ts` — Handle migration gracefully:
  - If `snippetCount` is undefined in meta, fall back to `loadAllThreads()` (one-time until all threads are touched)
  - Consider adding a `rebuildMetaCounts()` function that iterates all threads once and updates meta
- [ ] Migration: Add `rebuildMetaCounts()` to `src/core/storage.ts`:
  - Loads all threads once, updates meta with accurate counts
  - Called during `ensureMigrated()` if any thread lacks counts
  - Or exposed as CLI command for manual trigger

**Complication — `allLinkedFiles` set:**
The `list` operation builds a set of all linked files across all threads to filter the pending list. This still requires reading all threads OR maintaining a separate index of linked files. Options:
- **Option A:** Accept that `list` with pending files still loads all threads. Only optimize the thread listing part.
- **Option B:** Store a flat `allLinkedFiles: string[]` in the meta index. Updated whenever attach/detach runs.
- **Option C:** Skip the linked-file filter for pending — show all pending files regardless.

**Recommendation:** Option A for now. The snippet/file counts are the big win (avoids parsing all snippet content). The linked-files filter is a secondary optimization.

**Tests:**

- [ ] `tests/operations.test.ts` — Verify `listThreads()` returns correct counts from meta index
- [ ] `tests/operations.test.ts` — Verify counts update after `addSnippet`
- [ ] `tests/operations.test.ts` — Verify counts update after `attachFile` / `detachFile`
- [ ] `tests/operations.test.ts` — Verify backward compat: old meta without counts falls back correctly

**Files:** `src/core/storage.ts`, `src/core/operations/list.ts`, `tests/operations.test.ts`

---

#### Phase 3: Add `reindex` MCP Tool (Workflow Gap)

**Goal:** Let MCP-only users trigger semantic index rebuild.

**Tasks:**

- [ ] `src/mcp/server.ts` — Add `threadlinking_reindex` tool:
  ```typescript
  server.tool(
    'threadlinking_reindex',
    'Rebuild the semantic search index. Run after adding many snippets, or if semantic search returns stale results.',
    {},
    async () => {
      const result = await rebuildSemanticIndex();
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      };
    }
  );
  ```
- [ ] Verify `rebuildSemanticIndex` is already exported from `src/core/index.js`
- [ ] Update README MCP tools table — add `threadlinking_reindex` (13 tools now)
- [ ] Update `threadlinking_status` tool to mention reindex availability

**Tests:**

- [ ] Manual test via MCP: call `threadlinking_reindex`, verify index rebuilds

**Files:** `src/mcp/server.ts`, `README.md`

---

#### Phase 4: Optimize Semantic Search (Performance)

**Goal:** Stop loading all thread files on every semantic search.

**Approach:** Use `loadMetaIndex()` instead of `loadIndex()` in `semanticSearch()`. The search results only need thread ID, summary, and dates — all available in meta. Only load full thread data if the caller specifically needs snippet content.

**Tasks:**

- [ ] `src/core/operations/semantic.ts` — In `semanticSearch()`:
  - Replace `loadIndex()` with `loadMetaIndex()`
  - Build results using `meta.threads[threadId]` instead of `threadIndex[threadId]`
  - The `SemanticSearchResult` type already uses a subset that maps to `ThreadMeta`
- [ ] `src/core/types.ts` — Verify `SemanticSearchResult` shape:
  - Check if it references full `Thread` or just metadata fields
  - If it needs full thread data (e.g., matched snippet content), load only the matched thread files (top N)
- [ ] `src/mcp/server.ts` — Verify MCP semantic search handler doesn't depend on full thread data

**Risk:** If `SemanticSearchResult` includes matched snippet content (not just IDs), we'd need to load the specific matched thread files. This is still better than loading all threads — typically 3-5 results vs 50+ threads.

**Tests:**

- [ ] `tests/operations.test.ts` — Semantic search returns correct results (existing tests should cover)
- [ ] Performance: manual test with 50+ seeded threads to verify improvement

**Files:** `src/core/operations/semantic.ts`, possibly `src/core/types.ts`

---

#### Phase 5: Track Error Logging (Observability)

**Goal:** Make `track` command failures observable without blocking the editing workflow.

**Approach:** Write errors to a debug log file instead of swallowing silently. The hook stays async and non-blocking — it just leaves a trail.

**Tasks:**

- [ ] `src/commands/track.ts` — In the catch block:
  ```typescript
  catch (error) {
    try {
      const logPath = join(homedir(), '.threadlinking', 'debug.log');
      const timestamp = new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      appendFileSync(logPath, `[${timestamp}] track error: ${message}\n`);
    } catch {
      // If we can't even log, truly swallow
    }
  }
  ```
- [ ] Consider log rotation — if `debug.log` exceeds 100KB, truncate to last 50KB on write
- [ ] Add `debug.log` to `.threadlinkingignore` default content so it doesn't show as pending

**Tests:**

- [ ] `tests/operations.test.ts` — Verify track with corrupted pending.json writes to debug.log

**Files:** `src/commands/track.ts`, possibly `src/core/ignore.ts` (default ignore content)

---

## Acceptance Criteria

### Functional Requirements

- [ ] No function holds two locks simultaneously
- [ ] `threadlinking list` with 50+ threads does not load all thread files (when meta has counts)
- [ ] `threadlinking_reindex` MCP tool exists and rebuilds the semantic index
- [ ] `semanticSearch` does not call `loadAllThreads()` or `loadIndex()`
- [ ] `track` errors are logged to `~/.threadlinking/debug.log`

### Non-Functional Requirements

- [ ] All 195 existing tests pass after each phase
- [ ] Build succeeds with no TypeScript errors after each phase
- [ ] Backward compatible: existing `index.json` without counts works (graceful fallback)
- [ ] Lock ordering documented in code comments

### Quality Gates

- [ ] Concurrency tests added for Phase 1
- [ ] Count accuracy tests added for Phase 2
- [ ] Each phase is a separate commit for clean revert if needed

## Dependencies & Prerequisites

- Phase 2 depends on Phase 1 (meta update logic changes in Phase 1 affect how counts are written)
- Phase 3 is independent (can be done anytime)
- Phase 4 is independent (can be done anytime)
- Phase 5 is independent (can be done anytime)

```
Phase 1 (lock ordering) ──→ Phase 2 (meta counts)
Phase 3 (reindex MCP)       [independent]
Phase 4 (semantic perf)     [independent]
Phase 5 (track logging)     [independent]
```

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Phase 1 introduces brief meta inconsistency | Certain | Low | Meta is advisory; thread file is source of truth |
| Phase 2 migration misses threads | Low | Medium | Fallback to `loadAllThreads()` when counts missing |
| Phase 2 counts drift from reality | Low | Low | `extractMeta()` recalculates on every thread update |
| Phase 4 breaks semantic search result format | Low | Medium | Verify result type compatibility before changing |

## References

### Internal References

- Storage layer: `src/core/storage.ts` — all locking, atomic writes, migration
- Meta index structure: `src/core/storage.ts:42-51` (`ThreadMeta`, `MetaIndex`)
- Lock options: `src/core/storage.ts:66-69` (stale: 10s, update: 5s)
- `updateThread`: `src/core/storage.ts:278-313`
- `updateMetaIndex`: `src/core/storage.ts:220-236`
- `extractMeta`: `src/core/storage.ts:117-123`
- `loadAllThreads`: `src/core/storage.ts:339-356`
- List operation: `src/core/operations/list.ts:14-17` (hardcoded `needCounts = true`)
- Semantic search: `src/core/operations/semantic.ts`
- Track command: `src/commands/track.ts`
- MCP server: `src/mcp/server.ts`
- Test patterns: `tests/operations.test.ts`
- Relate operation (new): `src/core/operations/relate.ts` — sequential `updateThread` calls

### Lock Acquisition Map

| Function | Lock 1 | Lock 2 (nested) | Risk |
|----------|--------|-----------------|------|
| `updateThread(id, fn)` | Per-thread file | Meta index (via `updateMetaIndex`) | **Deadlock** |
| `updateMetaIndex(fn)` | Meta index | — | Safe |
| `saveThread(id, thread)` | — | Meta index (via `updateMetaIndex`) | Safe |
| `deleteThreadFile(id)` | — | Meta index (via `updateMetaIndex`) | Safe |
| `updatePending(fn)` | Pending file | — | Safe |
| `updateIndex(fn)` | Meta index (global) | — | Safe |
