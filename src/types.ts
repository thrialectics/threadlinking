export interface Snippet {
  content: string;
  source: string;
  url?: string;
  timestamp: string;
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
