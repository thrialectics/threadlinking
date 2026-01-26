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
  loadPending,
  savePending,
  removeFromPending,
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
  MAX_SUMMARY_LENGTH,
  MAX_TAG_LENGTH,
  MAX_SNIPPET_LENGTH,
  MAX_FILE_PATH_LENGTH,
} from './utils.js';

// Operations
export * from './operations/index.js';
