
export type NodeStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'blocked' | 'review';

export interface DagNode {
  id: string;
  title: string;
  description?: string;
  status: NodeStatus;
  dependencies: string[]; // Node IDs
  artifacts: string[]; // Artifact IDs
  assignedAgent?: string;
  startedAt?: number;
  completedAt?: number;
  owner?: string; // Add owner for Kanban display compatibility
}

export interface Run {
  id: string;
  name: string;
  nodes: DagNode[];
  status: 'active' | 'paused' | 'finished';
  startTime: number;
}

export interface CodeArtifact {
  id: string;
  name: string;
  type: 'file' | 'patch' | 'terminal_output' | 'mcp_result';
  uri: string;
  content?: string;
}
