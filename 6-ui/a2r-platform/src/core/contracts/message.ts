import { UUID, ISODate } from './base';

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'artifact'; artifactId: UUID }
  | { type: 'tool_call'; toolCallId: UUID }
  | { type: 'tool_result'; toolResultId: UUID }
  | { type: 'thinking'; thinking: string }
  | { type: 'image'; url: string; mimeType: string }
  | { type: 'code'; code: string; language: string }
  | { type: 'error'; error: string };

export interface Message {
  readonly id: UUID;
  readonly threadId: UUID;
  readonly projectId: UUID;
  
  role: 'user' | 'assistant' | 'system' | 'tool';
  authorId?: string;
  
  parts: MessagePart[];
  status: 'streaming' | 'pending' | 'completed' | 'error' | 'cancelled';
  
  streamState?: {
    isStreaming: boolean;
    streamId?: string;
    chunksReceived: number;
    lastChunkAt?: ISODate;
  };
  
  tokenCount?: {
    input: number;
    output: number;
    total: number;
  };
  
  cost?: {
    amount: number;
    currency: string;
    model: string;
  };
  
  timing: {
    sentAt: ISODate;
    firstTokenAt?: ISODate;
    completedAt?: ISODate;
    latencyMs?: number;
  };
  
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
  readonly version: number;
  
  generatedArtifactIds: UUID[];
  generatedChangeSetId?: UUID;
}
