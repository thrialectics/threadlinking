// Core types for threadlinking
// These types are used by both CLI and MCP server

export interface Snippet {
  content: string;
  source: string;
  url?: string;
  timestamp: string;
  tags?: string[];
}

export interface Thread {
  summary: string;
  snippets: Snippet[];
  linked_files: string[];
  chat_url?: string;
  date_created: string;
  date_modified?: string;
  auto_generated?: boolean;
}

export type ThreadIndex = Record<string, Thread>;

// Operation result types for consistent return values
export interface OperationResult<T = void> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface SnippetResult {
  threadId: string;
  snippetIndex: number;
  created: boolean;
  snippetCount: number;
}

export interface AttachResult {
  threadId: string;
  filePath: string;
  alreadyLinked: boolean;
}

export interface ExplainResult {
  filePath: string;
  threads: Array<{
    thread_id: string;
    summary: string;
    snippets: Snippet[];
    date_created: string;
    date_modified?: string;
    chat_url?: string;
  }>;
}

export interface ListResult {
  threads: Array<{
    id: string;
    summary: string;
    snippetCount: number;
    fileCount: number;
    dateModified?: string;
  }>;
  pending: Array<{
    path: string;
    basename: string;
    count: number;
    lastModified: string;
  }>;
}

export interface ShowResult {
  threadId: string;
  thread: Thread;
}

export interface SearchResult {
  query: string;
  results: Array<{
    id: string;
    thread: Thread;
    matchedIn: ('id' | 'summary' | 'snippets')[];
  }>;
}

// Input types for operations
export interface SnippetInput {
  threadId: string;
  content: string;
  source?: string;
  url?: string;
  tags?: string[];
  summary?: string;
}

export interface AttachInput {
  threadId: string;
  filePath: string;
}

export interface ListOptions {
  prefix?: string;
  since?: number;
  includePending?: boolean;
}

export interface ShowOptions {
  filterTag?: string;
}

export interface SearchOptions {
  query: string;
}
