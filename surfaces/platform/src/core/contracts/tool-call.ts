import { UUID, ISODate, RiskTier } from './base';

export interface ToolCall {
  readonly id: UUID;
  readonly messageId: UUID;
  readonly threadId: UUID;
  
  name: string;
  displayName?: string;
  arguments: Record<string, unknown>;
  
  status: 'pending' | 'approved' | 'rejected' | 'running' | 'completed' | 'error';
  
  approval?: {
    required: boolean;
    riskTier: RiskTier;
    requestedAt?: ISODate;
    respondedAt?: ISODate;
    approvedBy?: string;
    rejectionReason?: string;
  };
  
  execution?: {
    startedAt?: ISODate;
    completedAt?: ISODate;
    durationMs?: number;
    logs?: string[];
  };
  
  result?: unknown;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
}
