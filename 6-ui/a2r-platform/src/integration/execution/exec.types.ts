/**
 * Execution Bridge Types
 * 
 * Defines the contract between the UI and the Runtime Bridge.
 */

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface RunRequest {
  agentId: string;
  input: string;
  context?: Record<string, any>;
  files?: string[];
  tools?: string[]; // Specific tools to allow
}

export interface RunResult {
  runId: string;
  status: RunStatus;
  output?: string;
  error?: string;
  artifacts?: string[];
  metrics?: {
    duration: number;
    tokens?: number;
    cost?: number;
  };
}

export interface TraceFrame {
  id: string;
  runId: string;
  type: 'agent' | 'tool' | 'system';
  name: string;
  input?: any;
  output?: any;
  status: 'running' | 'success' | 'error';
  timestamp: number;
  duration?: number;
}

export interface ToolCall {
  id: string;
  runId: string;
  toolName: string;
  args: any;
  status: 'pending' | 'running' | 'complete' | 'error';
  result?: any;
  error?: string;
}
