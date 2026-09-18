export type CoworkMemoryEntryType = 'fact' | 'preference' | 'skill' | 'context';

export interface CoworkMemoryEntry {
  id: string;
  userId: string;
  projectId: string | null;
  sessionId: string | null;
  content: string;
  type: CoworkMemoryEntryType;
  tags: string[];
  source: string | null;
  createdAt: Date;
}

export interface CoworkMemoryCreateInput {
  userId: string;
  projectId?: string | null;
  sessionId?: string | null;
  content: string;
  type?: CoworkMemoryEntryType;
  tags?: string[];
  source?: string | null;
}
