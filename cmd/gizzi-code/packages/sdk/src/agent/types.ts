import type { Message, StreamRequest } from '../harness/types.js';

export type AgentRunStatus = 
  | 'queued' 
  | 'thinking' 
  | 'executing_tools' 
  | 'requires_reply' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export type ReplyOutcome = 
  | { type: 'permission'; approved: boolean; reason?: string }
  | { type: 'question'; answers: string[] };

export interface ReplyRequest {
  id: string;
  type: 'permission' | 'question';
  payload: {
    title?: string;
    description?: string;
    options?: Array<{ label: string; description: string }>;
    multiple?: boolean;
  };
  submit: (outcome: ReplyOutcome) => Promise<void>;
}

export interface AgentOptions {
  environment?: 'local' | 'lima' | 'cloud';
  capabilities?: string[];
  persistencePath?: string;
}
