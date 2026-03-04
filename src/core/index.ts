// Core index - main entry point for threadlinking core
// Used by both CLI and MCP server

// Types
export * from './types.js';

// Storage
export {
  loadIndex,
  saveIndex,
  getIndexPath,
  getBaseDir,
  getThreadsDir,
  loadPending,
  savePending,
  removeFromPending,
  updateIndex,
  updatePending,
  loadMetaIndex,
  updateMetaIndex,
  loadThread,
  saveThread,
  updateThread,
  deleteThreadFile,
  loadAllThreads,
  ensureMigrated,
  resetMigrationState,
} from './storage.js';

export type {
  ThreadMeta,
  MetaIndex,
  PendingFile,
  PendingState,
} from './storage.js';

// Utils
export {
  sanitizeString,
  validateTag,
  validateUrl,
  resolvePath,
  formatDate,
  detectSource,
  truncate,
  parseTags,
  detectProjectRoot,
  prompt,
  MAX_SUMMARY_LENGTH,
  MAX_TAG_LENGTH,
  MAX_SNIPPET_LENGTH,
  MAX_FILE_PATH_LENGTH,
} from './utils.js';

// Operations
export * from './operations/index.js';
