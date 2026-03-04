import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const originalHome = process.env.HOME;
let tempHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'tl-lifecycle-test-'));
  process.env.HOME = tempHome;
  vi.resetModules();
});

afterEach(() => {
  process.env.HOME = originalHome;
  rmSync(tempHome, { recursive: true, force: true });
});

describe('lifecycle', () => {
  it('step 1: create thread', async () => {
    const { createThread } = await import('../src/core/operations/create.js');
    const { loadIndex } = await import('../src/core/storage.js');

    const result = createThread({
      threadId: 'test-project',
      summary: 'Integration test project',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('test-project');
    expect(result.data?.threadId).toBe('test-project');
    expect(result.data?.created).toBe(true);

    const index = loadIndex();
    expect(index['test-project']).toBeDefined();
    expect(index['test-project'].summary).toBe('Integration test project');
    expect(index['test-project'].snippets).toEqual([]);
    expect(index['test-project'].linked_files).toEqual([]);
  });

  it('step 2: add snippets to thread', async () => {
    const { createThread } = await import('../src/core/operations/create.js');
    const { addSnippet } = await import('../src/core/operations/snippet.js');
    const { loadIndex } = await import('../src/core/storage.js');

    createThread({ threadId: 'test-project', summary: 'Integration test project' });

    const result1 = await addSnippet({
      threadId: 'test-project',
      content: 'Chose REST over GraphQL for simplicity',
    });

    expect(result1.success).toBe(true);
    expect(result1.data?.snippetCount).toBe(1);
    expect(result1.data?.created).toBe(false);

    const indexAfterFirst = loadIndex();
    expect(indexAfterFirst['test-project'].snippets).toHaveLength(1);
    expect(indexAfterFirst['test-project'].snippets[0].content).toBe(
      'Chose REST over GraphQL for simplicity'
    );

    const result2 = await addSnippet({
      threadId: 'test-project',
      content: 'Using JWT for stateless authentication across services',
      tags: ['decision', 'api'],
    });

    expect(result2.success).toBe(true);
    expect(result2.data?.snippetCount).toBe(2);

    const indexAfterSecond = loadIndex();
    expect(indexAfterSecond['test-project'].snippets).toHaveLength(2);
    expect(indexAfterSecond['test-project'].snippets[1].tags).toEqual(['decision', 'api']);
  });

  it('step 3: attach file to thread', async () => {
    const { createThread } = await import('../src/core/operations/create.js');
    const { attachFile } = await import('../src/core/operations/attach.js');

    createThread({ threadId: 'test-project', summary: 'Integration test project' });

    const srcDir = join(tempHome, 'src');
    mkdirSync(srcDir, { recursive: true });
    const filePath = join(srcDir, 'api.ts');
    writeFileSync(filePath, 'export const api = {};', 'utf-8');

    const attachResult = attachFile({
      threadId: 'test-project',
      filePath,
    });

    expect(attachResult.success).toBe(true);
    expect(attachResult.data?.alreadyLinked).toBe(false);
    expect(attachResult.data?.filePath).toBe(filePath);
    expect(attachResult.data?.threadId).toBe('test-project');

    const duplicateResult = attachFile({
      threadId: 'test-project',
      filePath,
    });

    expect(duplicateResult.success).toBe(true);
    expect(duplicateResult.data?.alreadyLinked).toBe(true);
    expect(duplicateResult.message).toContain('already linked');
  });

  it('step 4: explain attached file', async () => {
    const { createThread } = await import('../src/core/operations/create.js');
    const { attachFile } = await import('../src/core/operations/attach.js');
    const { addSnippet } = await import('../src/core/operations/snippet.js');
    const { explainFile } = await import('../src/core/operations/explain.js');

    createThread({ threadId: 'test-project', summary: 'Integration test project' });
    await addSnippet({
      threadId: 'test-project',
      content: 'Chose REST over GraphQL for simplicity',
    });

    const srcDir = join(tempHome, 'src');
    mkdirSync(srcDir, { recursive: true });
    const filePath = join(srcDir, 'api.ts');
    writeFileSync(filePath, 'export const api = {};', 'utf-8');

    attachFile({ threadId: 'test-project', filePath });

    const explainResult = explainFile(filePath);

    expect(explainResult.success).toBe(true);
    expect(explainResult.data?.filePath).toBe(filePath);
    expect(explainResult.data?.threads).toHaveLength(1);
    expect(explainResult.data?.threads[0].thread_id).toBe('test-project');
    expect(explainResult.data?.threads[0].summary).toBe('Integration test project');
    expect(explainResult.data?.threads[0].snippets).toHaveLength(1);
  });

  it('step 5: show thread with and without tag filter', async () => {
    const { createThread } = await import('../src/core/operations/create.js');
    const { addSnippet } = await import('../src/core/operations/snippet.js');
    const { attachFile } = await import('../src/core/operations/attach.js');
    const { showThread } = await import('../src/core/operations/show.js');

    createThread({ threadId: 'test-project', summary: 'Integration test project' });
    await addSnippet({
      threadId: 'test-project',
      content: 'Chose REST over GraphQL for simplicity',
    });
    await addSnippet({
      threadId: 'test-project',
      content: 'Using JWT for stateless authentication across services',
      tags: ['decision', 'api'],
    });

    const srcDir = join(tempHome, 'src');
    mkdirSync(srcDir, { recursive: true });
    const filePath = join(srcDir, 'api.ts');
    writeFileSync(filePath, 'export const api = {};', 'utf-8');
    attachFile({ threadId: 'test-project', filePath });

    const showResult = showThread('test-project');

    expect(showResult.success).toBe(true);
    expect(showResult.data?.threadId).toBe('test-project');
    expect(showResult.data?.thread.snippets).toHaveLength(2);
    expect(showResult.data?.thread.linked_files).toContain(filePath);

    const filteredResult = showThread('test-project', { filterTag: 'decision' });

    expect(filteredResult.success).toBe(true);
    expect(filteredResult.data?.thread.snippets).toHaveLength(1);
    expect(filteredResult.data?.thread.snippets[0].content).toBe(
      'Using JWT for stateless authentication across services'
    );
    expect(filteredResult.data?.thread.snippets[0].tags).toContain('decision');
  });

  it('step 6: search threads by keyword', async () => {
    const { createThread } = await import('../src/core/operations/create.js');
    const { addSnippet } = await import('../src/core/operations/snippet.js');
    const { searchThreads } = await import('../src/core/operations/search.js');

    createThread({ threadId: 'test-project', summary: 'Integration test project' });
    await addSnippet({
      threadId: 'test-project',
      content: 'Chose REST over GraphQL for simplicity',
    });

    const foundResult = searchThreads('REST');

    expect(foundResult.success).toBe(true);
    expect(foundResult.data?.results).toHaveLength(1);
    expect(foundResult.data?.results[0].id).toBe('test-project');
    expect(foundResult.data?.results[0].matchedIn).toContain('snippets');

    const emptyResult = searchThreads('nonexistent');

    expect(emptyResult.success).toBe(true);
    expect(emptyResult.data?.results).toHaveLength(0);
  });

  it('step 7: detach file from thread', async () => {
    const { createThread } = await import('../src/core/operations/create.js');
    const { attachFile, detachFile } = await import('../src/core/operations/attach.js');
    const { explainFile } = await import('../src/core/operations/explain.js');

    createThread({ threadId: 'test-project', summary: 'Integration test project' });

    const srcDir = join(tempHome, 'src');
    mkdirSync(srcDir, { recursive: true });
    const filePath = join(srcDir, 'api.ts');
    writeFileSync(filePath, 'export const api = {};', 'utf-8');

    attachFile({ threadId: 'test-project', filePath });

    const detachResult = detachFile({ threadId: 'test-project', filePath });

    expect(detachResult.success).toBe(true);
    expect(detachResult.data?.filePath).toBe(filePath);
    expect(detachResult.message).toContain('detached');

    const explainAfterDetach = explainFile(filePath);

    expect(explainAfterDetach.success).toBe(true);
    expect(explainAfterDetach.data?.threads).toHaveLength(0);
  });

  it('step 8: delete thread', async () => {
    const { createThread } = await import('../src/core/operations/create.js');
    const { updateIndex, loadIndex } = await import('../src/core/storage.js');
    const { showThread } = await import('../src/core/operations/show.js');

    createThread({ threadId: 'test-project', summary: 'Integration test project' });

    const indexBefore = loadIndex();
    expect(indexBefore['test-project']).toBeDefined();

    updateIndex((idx) => {
      delete idx['test-project'];
      return idx;
    });

    const indexAfter = loadIndex();
    expect(indexAfter['test-project']).toBeUndefined();

    const showResult = showThread('test-project');
    expect(showResult.success).toBe(false);
    expect(showResult.error).toBe('THREAD_NOT_FOUND');
  });

  it('step 9: clearPending removes all pending files', async () => {
    const { updatePending, loadPending } = await import('../src/core/storage.js');
    const { clearPending } = await import('../src/core/operations/list.js');

    updatePending((state) => {
      state.tracked.push(
        {
          path: join(tempHome, 'src', 'pending-a.ts'),
          first_seen: new Date().toISOString(),
          last_modified: new Date().toISOString(),
          count: 1,
        },
        {
          path: join(tempHome, 'src', 'pending-b.ts'),
          first_seen: new Date().toISOString(),
          last_modified: new Date().toISOString(),
          count: 2,
        }
      );
      return state;
    });

    const pendingBefore = loadPending();
    expect(pendingBefore.tracked).toHaveLength(2);

    const clearResult = clearPending();

    expect(clearResult.success).toBe(true);
    expect(clearResult.message).toContain('cleared');

    const pendingAfter = loadPending();
    expect(pendingAfter.tracked).toHaveLength(0);
  });
});
