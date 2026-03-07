import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// ─── Shared test infrastructure ─────────────────────────────────────────────

let tempHome: string;
const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'tl-test-'));
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome; // Windows uses USERPROFILE for homedir()
  vi.resetModules();
});

afterEach(() => {
  if (originalHome !== undefined) {
    process.env.HOME = originalHome;
  } else {
    delete process.env.HOME;
  }
  if (originalUserProfile !== undefined) {
    process.env.USERPROFILE = originalUserProfile;
  } else {
    delete process.env.USERPROFILE;
  }
  rmSync(tempHome, { recursive: true, force: true });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Seed the index with pre-built data by calling saveIndex directly.
 * This avoids depending on other operations to set up test state.
 */
async function seedIndex(data: Record<string, unknown>) {
  const { saveIndex } = await import('../src/core/storage.js');
  saveIndex(data as Parameters<typeof saveIndex>[0]);
}

/**
 * Build a minimal valid Thread object for test seeding.
 */
function makeThread(overrides: Partial<{
  summary: string;
  snippets: Array<{ content: string; source: string; timestamp: string; tags?: string[] }>;
  linked_files: string[];
  chat_url: string;
  date_created: string;
}> = {}) {
  return {
    summary: overrides.summary ?? 'A test thread',
    snippets: overrides.snippets ?? [],
    linked_files: overrides.linked_files ?? [],
    chat_url: overrides.chat_url ?? '',
    date_created: overrides.date_created ?? new Date().toISOString(),
  };
}

// ─── createThread ─────────────────────────────────────────────────────────────

describe('createThread', () => {
  it('returns success with the new thread id when creating a fresh thread', async () => {
    const { createThread } = await import('../src/core/operations/create.js');

    const result = createThread({ threadId: 'my-project' });

    expect(result.success).toBe(true);
    expect(result.data?.threadId).toBe('my-project');
  });

  it('returns created:true for a new thread', async () => {
    const { createThread } = await import('../src/core/operations/create.js');

    const result = createThread({ threadId: 'my-project' });

    expect(result.data?.created).toBe(true);
  });

  it('persists the thread so it can be loaded again', async () => {
    const { createThread } = await import('../src/core/operations/create.js');
    const { loadIndex } = await import('../src/core/storage.js');

    createThread({ threadId: 'persisted-thread' });
    const index = loadIndex();

    expect(index['persisted-thread']).toBeDefined();
  });

  it('defaults the summary to "(empty thread)" when no summary is provided', async () => {
    const { createThread } = await import('../src/core/operations/create.js');
    const { loadIndex } = await import('../src/core/storage.js');

    createThread({ threadId: 'no-summary' });
    const index = loadIndex();

    expect(index['no-summary'].summary).toBe('(empty thread)');
  });

  it('stores the provided summary on the thread', async () => {
    const { createThread } = await import('../src/core/operations/create.js');
    const { loadIndex } = await import('../src/core/storage.js');

    createThread({ threadId: 'with-summary', summary: 'My custom summary' });
    const index = loadIndex();

    expect(index['with-summary'].summary).toBe('My custom summary');
  });

  it('stores a chatUrl when provided', async () => {
    const { createThread } = await import('../src/core/operations/create.js');
    const { loadIndex } = await import('../src/core/storage.js');

    createThread({ threadId: 'with-url', chatUrl: 'https://example.com/chat' });
    const index = loadIndex();

    expect(index['with-url'].chat_url).toBe('https://example.com/chat');
  });

  it('returns success:false with THREAD_EXISTS when thread already exists', async () => {
    const { createThread } = await import('../src/core/operations/create.js');

    createThread({ threadId: 'duplicate' });
    const result = createThread({ threadId: 'duplicate' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('THREAD_EXISTS');
  });

  it('includes the thread id in the error message for duplicate detection', async () => {
    const { createThread } = await import('../src/core/operations/create.js');

    createThread({ threadId: 'duplicate-msg' });
    const result = createThread({ threadId: 'duplicate-msg' });

    expect(result.message).toContain('duplicate-msg');
  });

  it('creates the thread with an empty snippets array', async () => {
    const { createThread } = await import('../src/core/operations/create.js');
    const { loadIndex } = await import('../src/core/storage.js');

    createThread({ threadId: 'empty-snippets' });
    const index = loadIndex();

    expect(index['empty-snippets'].snippets).toEqual([]);
  });

  it('creates the thread with an empty linked_files array', async () => {
    const { createThread } = await import('../src/core/operations/create.js');
    const { loadIndex } = await import('../src/core/storage.js');

    createThread({ threadId: 'empty-files' });
    const index = loadIndex();

    expect(index['empty-files'].linked_files).toEqual([]);
  });
});

// ─── addSnippet ───────────────────────────────────────────────────────────────

describe('addSnippet', () => {
  it('adds a snippet to an existing thread', async () => {
    await seedIndex({ 'existing-thread': makeThread() });
    const { addSnippet } = await import('../src/core/operations/snippet.js');

    const result = await addSnippet({ threadId: 'existing-thread', content: 'Decision: use PostgreSQL' });

    expect(result.success).toBe(true);
  });

  it('returns snippetCount of 1 after the first addition', async () => {
    await seedIndex({ 'count-thread': makeThread() });
    const { addSnippet } = await import('../src/core/operations/snippet.js');

    const result = await addSnippet({ threadId: 'count-thread', content: 'First snippet' });

    expect(result.data?.snippetCount).toBe(1);
  });

  it('increments snippetCount on subsequent additions', async () => {
    await seedIndex({ 'multi-thread': makeThread() });
    const { addSnippet } = await import('../src/core/operations/snippet.js');

    await addSnippet({ threadId: 'multi-thread', content: 'First snippet' });
    const result = await addSnippet({ threadId: 'multi-thread', content: 'Second snippet' });

    expect(result.data?.snippetCount).toBe(2);
  });

  it('auto-creates the thread when it does not exist', async () => {
    const { addSnippet } = await import('../src/core/operations/snippet.js');

    const result = await addSnippet({ threadId: 'brand-new', content: 'Bootstrap decision' });

    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(true);
  });

  it('returns created:false when adding to an existing thread', async () => {
    await seedIndex({ 'already-here': makeThread() });
    const { addSnippet } = await import('../src/core/operations/snippet.js');

    const result = await addSnippet({ threadId: 'already-here', content: 'Some context' });

    expect(result.data?.created).toBe(false);
  });

  it('persists the snippet content to storage', async () => {
    await seedIndex({ 'persist-snippet': makeThread() });
    const { addSnippet } = await import('../src/core/operations/snippet.js');
    const { loadIndex } = await import('../src/core/storage.js');

    await addSnippet({ threadId: 'persist-snippet', content: 'Chose Redis for caching' });
    const index = loadIndex();

    expect(index['persist-snippet'].snippets[0].content).toBe('Chose Redis for caching');
  });

  it('rejects empty content and returns EMPTY_CONTENT error', async () => {
    await seedIndex({ 'empty-content': makeThread() });
    const { addSnippet } = await import('../src/core/operations/snippet.js');

    const result = await addSnippet({ threadId: 'empty-content', content: '' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('EMPTY_CONTENT');
  });

  it('rejects whitespace-only content', async () => {
    await seedIndex({ 'whitespace': makeThread() });
    const { addSnippet } = await import('../src/core/operations/snippet.js');

    const result = await addSnippet({ threadId: 'whitespace', content: '   ' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('EMPTY_CONTENT');
  });

  it('normalizes tags to lowercase', async () => {
    await seedIndex({ 'tag-thread': makeThread() });
    const { addSnippet } = await import('../src/core/operations/snippet.js');
    const { loadIndex } = await import('../src/core/storage.js');

    await addSnippet({ threadId: 'tag-thread', content: 'Tagged decision', tags: ['Auth', 'DECISION', 'Infrastructure'] });
    const index = loadIndex();

    expect(index['tag-thread'].snippets[0].tags).toEqual(['auth', 'decision', 'infrastructure']);
  });

  it('strips empty strings from the tags array', async () => {
    await seedIndex({ 'tag-filter': makeThread() });
    const { addSnippet } = await import('../src/core/operations/snippet.js');
    const { loadIndex } = await import('../src/core/storage.js');

    await addSnippet({ threadId: 'tag-filter', content: 'Tagged', tags: ['valid', '', '  '] });
    const index = loadIndex();

    expect(index['tag-filter'].snippets[0].tags).toEqual(['valid']);
  });

  it('stores a custom source when provided', async () => {
    await seedIndex({ 'source-thread': makeThread() });
    const { addSnippet } = await import('../src/core/operations/snippet.js');
    const { loadIndex } = await import('../src/core/storage.js');

    await addSnippet({ threadId: 'source-thread', content: 'From CLI', source: 'cli' });
    const index = loadIndex();

    expect(index['source-thread'].snippets[0].source).toBe('cli');
  });

  it('uses first line of content as auto-created thread summary when no summary provided', async () => {
    const { addSnippet } = await import('../src/core/operations/snippet.js');
    const { loadIndex } = await import('../src/core/storage.js');

    await addSnippet({ threadId: 'auto-summary', content: 'This is the first line\nSecond line here' });
    const index = loadIndex();

    expect(index['auto-summary'].summary).toContain('This is the first line');
  });
});

// ─── attachFile ───────────────────────────────────────────────────────────────

describe('attachFile', () => {
  it('successfully attaches a file path to an existing thread', async () => {
    await seedIndex({ 'attach-thread': makeThread() });
    const { attachFile } = await import('../src/core/operations/attach.js');

    const result = attachFile({ threadId: 'attach-thread', filePath: '/tmp/test/file.ts' });

    expect(result.success).toBe(true);
  });

  it('stores the resolved path in the thread linked_files', async () => {
    await seedIndex({ 'store-path': makeThread() });
    const { attachFile } = await import('../src/core/operations/attach.js');
    const { loadIndex } = await import('../src/core/storage.js');

    attachFile({ threadId: 'store-path', filePath: '/tmp/test/component.ts' });
    const index = loadIndex();

    expect(index['store-path'].linked_files).toContain('/tmp/test/component.ts');
  });

  it('returns the filePath in data', async () => {
    await seedIndex({ 'data-path': makeThread() });
    const { attachFile } = await import('../src/core/operations/attach.js');

    const result = attachFile({ threadId: 'data-path', filePath: '/tmp/test/api.ts' });

    expect(result.data?.filePath).toBe('/tmp/test/api.ts');
  });

  it('returns success:false with THREAD_NOT_FOUND when thread does not exist', async () => {
    const { attachFile } = await import('../src/core/operations/attach.js');

    const result = attachFile({ threadId: 'ghost-thread', filePath: '/tmp/test/file.ts' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('THREAD_NOT_FOUND');
  });

  it('includes the thread id in the THREAD_NOT_FOUND message', async () => {
    const { attachFile } = await import('../src/core/operations/attach.js');

    const result = attachFile({ threadId: 'nonexistent', filePath: '/tmp/test/file.ts' });

    expect(result.message).toContain('nonexistent');
  });

  it('is idempotent: returns success when file is already linked', async () => {
    await seedIndex({
      'idempotent-thread': makeThread({ linked_files: ['/tmp/test/already.ts'] }),
    });
    const { attachFile } = await import('../src/core/operations/attach.js');

    const result = attachFile({ threadId: 'idempotent-thread', filePath: '/tmp/test/already.ts' });

    expect(result.success).toBe(true);
  });

  it('returns alreadyLinked:true when file is already linked', async () => {
    await seedIndex({
      'already-linked': makeThread({ linked_files: ['/tmp/test/linked.ts'] }),
    });
    const { attachFile } = await import('../src/core/operations/attach.js');

    const result = attachFile({ threadId: 'already-linked', filePath: '/tmp/test/linked.ts' });

    expect(result.data?.alreadyLinked).toBe(true);
  });

  it('does not duplicate a file that is already linked', async () => {
    await seedIndex({
      'no-dup': makeThread({ linked_files: ['/tmp/test/once.ts'] }),
    });
    const { attachFile } = await import('../src/core/operations/attach.js');
    const { loadIndex } = await import('../src/core/storage.js');

    attachFile({ threadId: 'no-dup', filePath: '/tmp/test/once.ts' });
    const index = loadIndex();
    const occurrences = index['no-dup'].linked_files.filter((f) => f === '/tmp/test/once.ts');

    expect(occurrences).toHaveLength(1);
  });

  it('removes the file from pending after attaching', async () => {
    const { savePending, loadPending } = await import('../src/core/storage.js');
    await seedIndex({ 'pending-thread': makeThread() });

    const now = new Date().toISOString();
    savePending({
      tracked: [
        { path: '/tmp/test/tracked.ts', first_seen: now, last_modified: now, count: 1 },
      ],
    });

    const { attachFile } = await import('../src/core/operations/attach.js');
    attachFile({ threadId: 'pending-thread', filePath: '/tmp/test/tracked.ts' });

    const pending = loadPending();
    const stillTracked = pending.tracked.some((f) => f.path === '/tmp/test/tracked.ts');
    expect(stillTracked).toBe(false);
  });

  it('attaches a non-existent file with a warning in the message', async () => {
    await seedIndex({ 'warn-thread': makeThread() });
    const { attachFile } = await import('../src/core/operations/attach.js');

    const result = attachFile({ threadId: 'warn-thread', filePath: '/tmp/does-not-exist-ever.ts' });

    expect(result.success).toBe(true);
    expect(result.message).toContain('does not exist');
  });
});

// ─── detachFile ───────────────────────────────────────────────────────────────

describe('detachFile', () => {
  it('successfully detaches a linked file', async () => {
    await seedIndex({
      'detach-thread': makeThread({ linked_files: ['/tmp/test/remove-me.ts'] }),
    });
    const { detachFile } = await import('../src/core/operations/attach.js');

    const result = detachFile({ threadId: 'detach-thread', filePath: '/tmp/test/remove-me.ts' });

    expect(result.success).toBe(true);
  });

  it('removes the file from linked_files in storage', async () => {
    await seedIndex({
      'storage-detach': makeThread({ linked_files: ['/tmp/test/gone.ts'] }),
    });
    const { detachFile } = await import('../src/core/operations/attach.js');
    const { loadIndex } = await import('../src/core/storage.js');

    detachFile({ threadId: 'storage-detach', filePath: '/tmp/test/gone.ts' });
    const index = loadIndex();

    expect(index['storage-detach'].linked_files).not.toContain('/tmp/test/gone.ts');
  });

  it('returns success:false with THREAD_NOT_FOUND when thread does not exist', async () => {
    const { detachFile } = await import('../src/core/operations/attach.js');

    const result = detachFile({ threadId: 'ghost', filePath: '/tmp/test/file.ts' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('THREAD_NOT_FOUND');
  });

  it('returns success:false with FILE_NOT_LINKED when file was never attached', async () => {
    await seedIndex({ 'no-link': makeThread() });
    const { detachFile } = await import('../src/core/operations/attach.js');

    const result = detachFile({ threadId: 'no-link', filePath: '/tmp/test/stranger.ts' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('FILE_NOT_LINKED');
  });

  it('includes the file path in the FILE_NOT_LINKED message', async () => {
    await seedIndex({ 'msg-thread': makeThread() });
    const { detachFile } = await import('../src/core/operations/attach.js');

    const result = detachFile({ threadId: 'msg-thread', filePath: '/tmp/test/stranger.ts' });

    expect(result.message).toContain('/tmp/test/stranger.ts');
  });

  it('leaves other linked files untouched when detaching one', async () => {
    await seedIndex({
      'multi-file': makeThread({ linked_files: ['/tmp/test/keep.ts', '/tmp/test/remove.ts'] }),
    });
    const { detachFile } = await import('../src/core/operations/attach.js');
    const { loadIndex } = await import('../src/core/storage.js');

    detachFile({ threadId: 'multi-file', filePath: '/tmp/test/remove.ts' });
    const index = loadIndex();

    expect(index['multi-file'].linked_files).toContain('/tmp/test/keep.ts');
    expect(index['multi-file'].linked_files).not.toContain('/tmp/test/remove.ts');
  });
});

// ─── explainFile ──────────────────────────────────────────────────────────────

describe('explainFile', () => {
  it('returns success:true even when no threads are linked to the file', async () => {
    const { explainFile } = await import('../src/core/operations/explain.js');

    const result = explainFile('/tmp/test/orphan.ts');

    expect(result.success).toBe(true);
  });

  it('returns an empty threads array when no threads are linked', async () => {
    const { explainFile } = await import('../src/core/operations/explain.js');

    const result = explainFile('/tmp/test/orphan.ts');

    expect(result.data?.threads).toEqual([]);
  });

  it('includes a descriptive message when no threads are linked', async () => {
    const { explainFile } = await import('../src/core/operations/explain.js');

    const result = explainFile('/tmp/test/orphan.ts');

    expect(result.message).toContain('No ThreadLink context');
  });

  it('returns the single thread linked to a file', async () => {
    await seedIndex({
      'explain-owner': makeThread({ linked_files: ['/tmp/test/owned.ts'] }),
    });
    const { explainFile } = await import('../src/core/operations/explain.js');

    const result = explainFile('/tmp/test/owned.ts');

    expect(result.data?.threads).toHaveLength(1);
    expect(result.data?.threads[0].thread_id).toBe('explain-owner');
  });

  it('returns all threads when multiple threads link to the same file', async () => {
    await seedIndex({
      'thread-a': makeThread({ linked_files: ['/tmp/test/shared.ts'] }),
      'thread-b': makeThread({ linked_files: ['/tmp/test/shared.ts'] }),
    });
    const { explainFile } = await import('../src/core/operations/explain.js');

    const result = explainFile('/tmp/test/shared.ts');

    expect(result.data?.threads).toHaveLength(2);
  });

  it('includes correct thread ids when multiple threads link to the same file', async () => {
    await seedIndex({
      'alpha': makeThread({ linked_files: ['/tmp/test/multi-owned.ts'] }),
      'beta': makeThread({ linked_files: ['/tmp/test/multi-owned.ts'] }),
    });
    const { explainFile } = await import('../src/core/operations/explain.js');

    const result = explainFile('/tmp/test/multi-owned.ts');
    const ids = result.data?.threads.map((t) => t.thread_id).sort();

    expect(ids).toEqual(['alpha', 'beta']);
  });

  it('includes thread summary in the result', async () => {
    await seedIndex({
      'summary-thread': makeThread({ summary: 'Authentication system', linked_files: ['/tmp/test/auth.ts'] }),
    });
    const { explainFile } = await import('../src/core/operations/explain.js');

    const result = explainFile('/tmp/test/auth.ts');

    expect(result.data?.threads[0].summary).toBe('Authentication system');
  });

  it('includes the snippets belonging to the matched thread', async () => {
    const snippet = { content: 'Used JWT for stateless auth', source: 'manual', timestamp: new Date().toISOString() };
    await seedIndex({
      'snippet-explain': makeThread({ snippets: [snippet], linked_files: ['/tmp/test/jwt.ts'] }),
    });
    const { explainFile } = await import('../src/core/operations/explain.js');

    const result = explainFile('/tmp/test/jwt.ts');

    expect(result.data?.threads[0].snippets).toHaveLength(1);
    expect(result.data?.threads[0].snippets[0].content).toBe('Used JWT for stateless auth');
  });

  it('includes the resolved file path in the result data', async () => {
    const { explainFile } = await import('../src/core/operations/explain.js');

    const result = explainFile('/tmp/test/check-path.ts');

    expect(result.data?.filePath).toBe('/tmp/test/check-path.ts');
  });
});

// ─── showThread ───────────────────────────────────────────────────────────────

describe('showThread', () => {
  it('returns success:true for an existing thread', async () => {
    await seedIndex({ 'show-me': makeThread() });
    const { showThread } = await import('../src/core/operations/show.js');

    const result = showThread('show-me');

    expect(result.success).toBe(true);
  });

  it('returns the correct threadId in data', async () => {
    await seedIndex({ 'id-check': makeThread() });
    const { showThread } = await import('../src/core/operations/show.js');

    const result = showThread('id-check');

    expect(result.data?.threadId).toBe('id-check');
  });

  it('returns the thread summary', async () => {
    await seedIndex({ 'summary-show': makeThread({ summary: 'Payment processor integration' }) });
    const { showThread } = await import('../src/core/operations/show.js');

    const result = showThread('summary-show');

    expect(result.data?.thread.summary).toBe('Payment processor integration');
  });

  it('returns all snippets when no tag filter is applied', async () => {
    const snippets = [
      { content: 'Snippet one', source: 'manual', timestamp: new Date().toISOString(), tags: ['a'] },
      { content: 'Snippet two', source: 'manual', timestamp: new Date().toISOString(), tags: ['b'] },
    ];
    await seedIndex({ 'all-snippets': makeThread({ snippets }) });
    const { showThread } = await import('../src/core/operations/show.js');

    const result = showThread('all-snippets');

    expect(result.data?.thread.snippets).toHaveLength(2);
  });

  it('returns success:false with THREAD_NOT_FOUND for a missing thread', async () => {
    const { showThread } = await import('../src/core/operations/show.js');

    const result = showThread('does-not-exist');

    expect(result.success).toBe(false);
    expect(result.error).toBe('THREAD_NOT_FOUND');
  });

  it('includes the thread id in the THREAD_NOT_FOUND message', async () => {
    const { showThread } = await import('../src/core/operations/show.js');

    const result = showThread('missing-thread');

    expect(result.message).toContain('missing-thread');
  });

  it('filters snippets by tag when filterTag option is provided', async () => {
    const snippets = [
      { content: 'Auth decision', source: 'manual', timestamp: new Date().toISOString(), tags: ['auth'] },
      { content: 'DB decision', source: 'manual', timestamp: new Date().toISOString(), tags: ['database'] },
      { content: 'Another auth', source: 'manual', timestamp: new Date().toISOString(), tags: ['auth', 'security'] },
    ];
    await seedIndex({ 'filtered': makeThread({ snippets }) });
    const { showThread } = await import('../src/core/operations/show.js');

    const result = showThread('filtered', { filterTag: 'auth' });

    expect(result.data?.thread.snippets).toHaveLength(2);
  });

  it('returns zero snippets when tag filter matches nothing', async () => {
    const snippets = [
      { content: 'DB decision', source: 'manual', timestamp: new Date().toISOString(), tags: ['database'] },
    ];
    await seedIndex({ 'no-match-filter': makeThread({ snippets }) });
    const { showThread } = await import('../src/core/operations/show.js');

    const result = showThread('no-match-filter', { filterTag: 'nonexistent-tag' });

    expect(result.data?.thread.snippets).toHaveLength(0);
  });

  it('performs case-insensitive tag filtering', async () => {
    const snippets = [
      { content: 'Security snippet', source: 'manual', timestamp: new Date().toISOString(), tags: ['Security'] },
    ];
    await seedIndex({ 'case-filter': makeThread({ snippets }) });
    const { showThread } = await import('../src/core/operations/show.js');

    const result = showThread('case-filter', { filterTag: 'SECURITY' });

    expect(result.data?.thread.snippets).toHaveLength(1);
  });

  it('returns linked_files in the thread data', async () => {
    await seedIndex({
      'files-show': makeThread({ linked_files: ['/tmp/test/app.ts', '/tmp/test/db.ts'] }),
    });
    const { showThread } = await import('../src/core/operations/show.js');

    const result = showThread('files-show');

    expect(result.data?.thread.linked_files).toEqual(['/tmp/test/app.ts', '/tmp/test/db.ts']);
  });
});

// ─── listThreads ──────────────────────────────────────────────────────────────

describe('listThreads', () => {
  it('returns success:true with an empty index', async () => {
    const { listThreads } = await import('../src/core/operations/list.js');

    const result = listThreads();

    expect(result.success).toBe(true);
  });

  it('returns an empty threads array when no threads exist', async () => {
    const { listThreads } = await import('../src/core/operations/list.js');

    const result = listThreads();

    expect(result.data?.threads).toEqual([]);
  });

  it('includes a "no threads" message when index is empty', async () => {
    const { listThreads } = await import('../src/core/operations/list.js');

    const result = listThreads();

    expect(result.message).toContain('No threads');
  });

  it('lists all threads when no filter is applied', async () => {
    await seedIndex({
      'proj-alpha': makeThread({ summary: 'Alpha project' }),
      'proj-beta': makeThread({ summary: 'Beta project' }),
      'proj-gamma': makeThread({ summary: 'Gamma project' }),
    });
    const { listThreads } = await import('../src/core/operations/list.js');

    const result = listThreads();

    expect(result.data?.threads).toHaveLength(3);
  });

  it('includes the thread id in each list entry', async () => {
    await seedIndex({ 'list-id-check': makeThread() });
    const { listThreads } = await import('../src/core/operations/list.js');

    const result = listThreads();

    expect(result.data?.threads[0].id).toBe('list-id-check');
  });

  it('reports the correct snippetCount for each thread', async () => {
    const snippets = [
      { content: 'One', source: 'manual', timestamp: new Date().toISOString() },
      { content: 'Two', source: 'manual', timestamp: new Date().toISOString() },
    ];
    await seedIndex({ 'snippet-count': makeThread({ snippets }) });
    const { listThreads } = await import('../src/core/operations/list.js');

    const result = listThreads();
    const entry = result.data?.threads.find((t) => t.id === 'snippet-count');

    expect(entry?.snippetCount).toBe(2);
  });

  it('reports the correct fileCount for each thread', async () => {
    await seedIndex({
      'file-count': makeThread({ linked_files: ['/tmp/a.ts', '/tmp/b.ts', '/tmp/c.ts'] }),
    });
    const { listThreads } = await import('../src/core/operations/list.js');

    const result = listThreads();
    const entry = result.data?.threads.find((t) => t.id === 'file-count');

    expect(entry?.fileCount).toBe(3);
  });

  it('filters by prefix, returning only matching threads', async () => {
    await seedIndex({
      'api-users': makeThread(),
      'api-orders': makeThread(),
      'frontend-home': makeThread(),
    });
    const { listThreads } = await import('../src/core/operations/list.js');

    const result = listThreads({ prefix: 'api' });
    const ids = result.data?.threads.map((t) => t.id).sort();

    expect(ids).toEqual(['api-orders', 'api-users']);
  });

  it('returns an empty list when no threads match the prefix', async () => {
    await seedIndex({ 'backend-api': makeThread() });
    const { listThreads } = await import('../src/core/operations/list.js');

    const result = listThreads({ prefix: 'frontend' });

    expect(result.data?.threads).toHaveLength(0);
  });

  it('includes a count message when threads are found', async () => {
    await seedIndex({ 'counted-thread': makeThread() });
    const { listThreads } = await import('../src/core/operations/list.js');

    const result = listThreads();

    expect(result.message).toContain('1 thread');
  });
});

// ─── searchThreads ────────────────────────────────────────────────────────────

describe('searchThreads', () => {
  it('matches a query found in a thread id', async () => {
    await seedIndex({ 'authentication-service': makeThread({ summary: 'Some unrelated summary' }) });
    const { searchThreads } = await import('../src/core/operations/search.js');

    const result = searchThreads('authentication');

    expect(result.success).toBe(true);
    expect(result.data?.results).toHaveLength(1);
  });

  it('includes "id" in matchedIn when the query hits the thread id', async () => {
    await seedIndex({ 'payment-gateway': makeThread() });
    const { searchThreads } = await import('../src/core/operations/search.js');

    const result = searchThreads('payment');
    const match = result.data?.results[0];

    expect(match?.matchedIn).toContain('id');
  });

  it('matches a query found in the thread summary', async () => {
    await seedIndex({ 'unrelated-id': makeThread({ summary: 'Chose Redis for caching layer' }) });
    const { searchThreads } = await import('../src/core/operations/search.js');

    const result = searchThreads('redis');

    expect(result.data?.results).toHaveLength(1);
  });

  it('includes "summary" in matchedIn when the query hits the summary', async () => {
    await seedIndex({ 'generic-id': makeThread({ summary: 'PostgreSQL was chosen for ACID compliance' }) });
    const { searchThreads } = await import('../src/core/operations/search.js');

    const result = searchThreads('postgresql');
    const match = result.data?.results[0];

    expect(match?.matchedIn).toContain('summary');
  });

  it('matches a query found inside a snippet', async () => {
    const snippets = [
      { content: 'Switched from REST to GraphQL after N+1 issues', source: 'manual', timestamp: new Date().toISOString() },
    ];
    await seedIndex({ 'graphql-thread': makeThread({ snippets }) });
    const { searchThreads } = await import('../src/core/operations/search.js');

    const result = searchThreads('graphql');

    expect(result.data?.results).toHaveLength(1);
  });

  it('includes "snippets" in matchedIn when the query hits snippet content', async () => {
    const snippets = [
      { content: 'Event sourcing for audit trail', source: 'manual', timestamp: new Date().toISOString() },
    ];
    await seedIndex({ 'event-thread': makeThread({ snippets }) });
    const { searchThreads } = await import('../src/core/operations/search.js');

    const result = searchThreads('event sourcing');
    const match = result.data?.results[0];

    expect(match?.matchedIn).toContain('snippets');
  });

  it('returns zero results when query matches nothing', async () => {
    await seedIndex({ 'unrelated': makeThread({ summary: 'Nothing relevant here' }) });
    const { searchThreads } = await import('../src/core/operations/search.js');

    const result = searchThreads('zxqwerty12345');

    expect(result.success).toBe(true);
    expect(result.data?.results).toHaveLength(0);
  });

  it('includes a "no matching threads" message when nothing is found', async () => {
    const { searchThreads } = await import('../src/core/operations/search.js');

    const result = searchThreads('xyznonexistentterm');

    expect(result.message).toContain('No matching threads');
  });

  it('returns success:false with EMPTY_QUERY for an empty query string', async () => {
    const { searchThreads } = await import('../src/core/operations/search.js');

    const result = searchThreads('');

    expect(result.success).toBe(false);
    expect(result.error).toBe('EMPTY_QUERY');
  });

  it('returns success:false with EMPTY_QUERY for a whitespace-only query', async () => {
    const { searchThreads } = await import('../src/core/operations/search.js');

    const result = searchThreads('   ');

    expect(result.success).toBe(false);
    expect(result.error).toBe('EMPTY_QUERY');
  });

  it('is case-insensitive when matching', async () => {
    await seedIndex({ 'case-search': makeThread({ summary: 'Using TypeScript for type safety' }) });
    const { searchThreads } = await import('../src/core/operations/search.js');

    const result = searchThreads('TYPESCRIPT');

    expect(result.data?.results).toHaveLength(1);
  });

  it('can match in multiple fields simultaneously and reports all of them', async () => {
    const snippets = [
      { content: 'Using websockets for real-time', source: 'manual', timestamp: new Date().toISOString() },
    ];
    await seedIndex({
      'websocket-app': makeThread({ summary: 'WebSocket integration', snippets }),
    });
    const { searchThreads } = await import('../src/core/operations/search.js');

    const result = searchThreads('websocket');
    const match = result.data?.results[0];

    expect(match?.matchedIn).toContain('id');
    expect(match?.matchedIn).toContain('summary');
    expect(match?.matchedIn).toContain('snippets');
  });

  it('echoes the normalised query back in the result data', async () => {
    const { searchThreads } = await import('../src/core/operations/search.js');

    const result = searchThreads('Redis');

    expect(result.data?.query).toBe('redis');
  });

  it('returns multiple results when multiple threads match', async () => {
    await seedIndex({
      'postgres-backend': makeThread({ summary: 'PostgreSQL backend' }),
      'postgres-analytics': makeThread({ summary: 'PostgreSQL analytics pipeline' }),
      'mongo-archive': makeThread({ summary: 'MongoDB archive store' }),
    });
    const { searchThreads } = await import('../src/core/operations/search.js');

    const result = searchThreads('postgres');

    expect(result.data?.results).toHaveLength(2);
  });
});
