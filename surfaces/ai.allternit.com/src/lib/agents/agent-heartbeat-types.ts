/**
 * Agent HEARTBEAT Types
 *
 * Pure type definitions shared between client and server.
 * Keeping types in a separate file prevents turbopack from tracing
 * server-only modules (like agent-heartbeat-shell.server.ts) into
 * the client bundle via import-type chains.
 */

export type TaskFrequency = 'startup' | 'daily' | 'weekly' | 'monthly';

export interface HeartbeatTask {
  id: string;
  frequency: TaskFrequency;
  action: string;
  description?: string;
  notify?: 'never' | 'on_failure' | 'on_success' | 'always';
  autoApprove?: boolean;
  lastExecuted?: Date;
  nextScheduled?: Date;
}

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  output?: string;
  error?: string;
  executionTimeMs: number;
  timestamp: Date;
}

export interface CoworkTaskIntegration {
  taskId?: string;
  projectId?: string;
  createIfNotExists?: boolean;
}
