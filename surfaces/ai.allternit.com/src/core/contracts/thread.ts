import { UUID, ISODate } from './base';

export interface Thread {
  readonly id: UUID;
  readonly projectId: UUID;
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
  readonly version: number;
  
  title: string;
  mode: 'llm' | 'agent';
  status: 'active' | 'paused' | 'completed' | 'archived';
  
  messageIds: UUID[];
  artifactIds: UUID[];
  changeSetIds: UUID[];
  
  openclawSessionId?: string;
  
  currentMessageId: UUID | null;
  checkpointId: UUID | null;
  
  metadata: {
    messageCount: number;
    lastMessageAt: ISODate | null;
    estimatedTokens: number;
  };
}
