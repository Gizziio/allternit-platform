import { UUID, ISODate } from './base';

export interface Artifact {
  readonly id: UUID;
  readonly threadId: UUID;
  readonly projectId: UUID;
  readonly messageId: UUID;
  
  type: 'code' | 'markdown' | 'mermaid' | 'svg' | 'html' | 'react' | 'json' | 'yaml' | 'terminal' | 'diff' | 'unknown';
  title: string;
  description?: string;
  
  content: string;
  language?: string;
  
  version: number;
  versions: {
    version: number;
    content: string;
    changeDescription?: string;
    createdAt: ISODate;
    createdBy: 'user' | 'assistant';
  }[];
  
  status: 'streaming' | 'preview' | 'editing' | 'saved' | 'rejected' | 'error';
  viewMode: 'preview' | 'code' | 'split';
  isPinned: boolean;
  
  fileSync?: {
    filePath: string;
    lastSyncedAt: ISODate;
    syncStatus: 'synced' | 'modified' | 'conflict' | 'error';
    autoSync: boolean;
  };
  
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
  createdBy: 'user' | 'assistant';
  
  error?: {
    message: string;
    code: string;
    recoverable: boolean;
  };
}
