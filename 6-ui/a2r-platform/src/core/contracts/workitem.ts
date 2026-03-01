import { UUID, ISODate } from './base';

export type WorkItemStatus = 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'done';
export type WorkItemPriority = 'low' | 'medium' | 'high' | 'critical';

export interface WorkItem {
  readonly id: UUID;
  readonly projectId: UUID;
  
  title: string;
  description: string;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  
  threadId?: UUID;
  runId?: UUID;
  changeSetId?: UUID;
  
  assigneeId?: string;
  
  readonly createdAt: ISODate;
  startedAt?: ISODate;
  completedAt?: ISODate;
  readonly updatedAt: ISODate;
  
  tags: string[];
  estimatedHours?: number;
  actualHours?: number;
}
