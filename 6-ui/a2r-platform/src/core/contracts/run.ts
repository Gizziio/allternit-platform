import { UUID, ISODate } from './base';

export interface Run {
  readonly id: UUID;
  readonly threadId: UUID;
  readonly projectId: UUID;
  
  name: string;
  description?: string;
  
  status: 'queued' | 'starting' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  
  steps: {
    readonly id: string;
    index: number;
    type: 'thinking' | 'tool_call' | 'file_edit' | 'user_input' | 'error' | 'checkpoint';
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    content: string;
    toolCallId?: UUID;
    changeSetId?: UUID;
    artifactId?: UUID;
    startedAt?: ISODate;
    completedAt?: ISODate;
  }[];
  
  currentStepIndex: number;
  
  resources: {
    tokensUsed: number;
    cost: number;
    durationMs?: number;
  };
  
  changeSetIds: UUID[];
  toolCallIds: UUID[];
  artifactIds: UUID[];
  
  isPausable: boolean;
  isCancellable: boolean;
  
  error?: {
    message: string;
    code: string;
    recoverable: boolean;
    retryable: boolean;
  };
  
  readonly createdAt: ISODate;
  startedAt?: ISODate;
  completedAt?: ISODate;
  readonly updatedAt: ISODate;
}
