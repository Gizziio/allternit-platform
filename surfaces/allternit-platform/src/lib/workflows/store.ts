export interface WorkflowNode {
  id: string;
  type: string;
  modeId?: string;
  config?: Record<string, unknown>;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt?: number | string;
  updatedAt?: number | string;
}
