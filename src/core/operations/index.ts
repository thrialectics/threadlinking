// Operations index - re-exports all operations
// Use this for clean imports in CLI and MCP server

export { addSnippet } from './snippet.js';
export { createThread } from './create.js';
export { attachFile, detachFile } from './attach.js';
export { explainFile } from './explain.js';
export { showThread, getThread } from './show.js';
export { listThreads, clearPending } from './list.js';
export { searchThreads } from './search.js';

// Premium operations (license required)
export { semanticSearch } from './semantic.js';
export { getAnalytics } from './analytics.js';
export { exportThread } from './export.js';
export type { SemanticSearchResult } from './semantic.js';
export type { AnalyticsResult } from './analytics.js';
export type { ExportFormat, ExportResult } from './export.js';
