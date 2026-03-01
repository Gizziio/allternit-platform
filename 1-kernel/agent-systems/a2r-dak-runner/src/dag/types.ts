/**
 * DAG Types
 * 
 * Based on agent/Agentic Prompts/formats/dag-schema.md
 */

export type ExecutionPermissionMode = 'read_only' | 'write_leased' | 'yolo';
export type GateName = 
  | 'validator_pass' 
  | 'tests_green' 
  | 'lint_green' 
  | 'policy_pass'
  | 'security_pass'
  | 'evidence_attached'
  | 'plan_synced';
export type OnFailAction = 'ralph' | 'halt';
export type NodeStatus = 'pending' | 'ready' | 'running' | 'blocked' | 'done' | 'failed';

export interface DagDefinition {
  dag_version: number;
  dag_id: string;
  title: string;
  sot?: string;  // Source of truth pointer
  defaults: DagDefaults;
  nodes: DagNode[];
  hooks?: DagHooks;
  concurrency?: ConcurrencyPolicy;
}

export interface DagDefaults {
  gates?: GateName[];
  max_iterations?: number;
  execution_permission?: {
    mode: ExecutionPermissionMode;
  };
}

export interface DagNode {
  id: string;
  wih: string;  // Path to WIH file
  depends_on: string[];
  gates?: GateName[];
  roles?: RoleAssignments;
  loop?: LoopConfig;
  stop_conditions?: StopConditions;
  output?: OutputConfig;
  execution_permission?: {
    mode: ExecutionPermissionMode;
  };
  
  // Runtime fields
  status?: NodeStatus;
  iteration_count?: number;
  current_worker_id?: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface RoleAssignments {
  orchestrator?: string;
  builder?: string;
  validator?: string;
  reviewer?: string;
  security?: string;
}

export interface LoopConfig {
  max_iterations: number;
  on_fail: OnFailAction;
}

export interface StopConditions {
  escalate_if?: string[];
}

export interface OutputConfig {
  close_on_pass?: boolean;
}

export interface DagHooks {
  on_dag_start?: string[];
  on_node_start?: string[];
  on_node_end?: string[];
}

export interface ConcurrencyPolicy {
  max_parallel_nodes?: number;
  allow_parallel_if_no_path_overlap?: boolean;
}

// Execution context
export interface DagExecutionContext {
  dag_id: string;
  run_id: string;
  started_at: string;
  current_node_id?: string;
  completed_nodes: string[];
  failed_nodes: string[];
  blocked_nodes: string[];
}

// Gate evaluation result
export interface GateEvaluation {
  gate: GateName;
  status: 'pass' | 'fail' | 'pending';
  reason?: string;
  evidence_receipts?: string[];
}

// Node execution result
export interface NodeExecutionResult {
  node_id: string;
  status: NodeStatus;
  gates: GateEvaluation[];
  iteration_count: number;
  receipts: string[];
  artifacts: string[];
  error?: string;
  started_at: string;
  completed_at?: string;
}
