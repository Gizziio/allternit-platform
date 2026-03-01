/**
 * Workflow Types
 * 
 * Ported from: 6-ui/shell-ui/src/views/workflow/*.rs
 * 
 * Shell UI components for workflow management:
 * - Visual workflow designer (DAG builder)
 * - Execution monitor
 * - Workflow list and management
 */

// Re-export from workflowEngine for hooks
export type { ValidationResult } from '@/services/workflowEngine';

// ============================================================================
// Workflow Designer Types
// ============================================================================

/** Workflow designer state */
export interface WorkflowDesigner {
  /** Current workflow being edited */
  workflow: WorkflowDraft;
  /** Selected node ID */
  selected_node?: string;
  /** Selected edge ID */
  selected_edge?: string;
  /** Canvas/viewport state */
  viewport: ViewportState;
  /** Available node types */
  node_types: NodeTypeDefinition[];
  /** Validation errors */
  validation_errors: ValidationError[];
}

/** Workflow draft (work in progress) */
export interface WorkflowDraft {
  workflow_id: string;
  version: string;
  description: string;
  nodes: DesignerNode[];
  edges: DesignerEdge[];
}

/** Designer node (with UI state) */
export interface DesignerNode {
  id: string;
  name: string;
  node_type: string;
  phase: WorkflowPhase;
  position: NodePosition;
  inputs: string[];
  outputs: string[];
  config: Record<string, unknown>;
}

/** Node position on canvas */
export interface NodePosition {
  x: number;
  y: number;
}

/** Designer edge (with UI state) */
export interface DesignerEdge {
  id: string;
  from: string;
  to: string;
  condition?: string;
}

/** Viewport state for designer canvas */
export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

/** Node type definition */
export interface NodeTypeDefinition {
  id: string;
  name: string;
  description: string;
  category: NodeCategory;
  icon: string;
  default_config: Record<string, unknown>;
  input_ports: PortDefinition[];
  output_ports: PortDefinition[];
}

/** Node category */
export enum NodeCategory {
  Source = 'source',
  Transform = 'transform',
  Sink = 'sink',
  Control = 'control',
  Custom = 'custom',
}

/** Port definition */
export interface PortDefinition {
  id: string;
  name: string;
  type: PortType;
  required: boolean;
  description?: string;
}

/** Port data type */
export enum PortType {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Object = 'object',
  Array = 'array',
  Binary = 'binary',
  Any = 'any',
}

/** Validation error */
export interface ValidationError {
  code: string;
  message: string;
  node_id?: string;
  edge_id?: string;
  severity: 'error' | 'warning';
}

/** Workflow phase */
export enum WorkflowPhase {
  Draft = 'draft',
  Active = 'active',
  Deprecated = 'deprecated',
  Archived = 'archived',
}

// ============================================================================
// Workflow Monitor Types
// ============================================================================

/** Workflow monitor state */
export interface WorkflowMonitor {
  /** Active executions */
  active_executions: WorkflowExecution[];
  /** Historical executions */
  historical_executions: WorkflowExecution[];
  /** Selected execution */
  selected_execution?: string;
  /** System status */
  system_status: WorkflowSystemStatus;
}

/** Workflow execution instance */
export interface WorkflowExecution {
  execution_id: string;
  workflow_id: string;
  workflow_name: string;
  status: ExecutionStatus;
  started_at: string;
  finished_at?: string;
  triggered_by: string;
  node_executions: NodeExecution[];
  logs: ExecutionLog[];
}

/** Execution status */
export enum ExecutionStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

/** Node execution within a workflow */
export interface NodeExecution {
  node_id: string;
  node_name: string;
  status: ExecutionStatus;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  input_summary?: string;
  output_summary?: string;
  error?: ExecutionError;
}

/** Execution error details */
export interface ExecutionError {
  code: string;
  message: string;
  stack_trace?: string;
  retryable: boolean;
}

/** Execution log entry */
export interface ExecutionLog {
  timestamp: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  node_id?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/** Workflow system status */
export interface WorkflowSystemStatus {
  total_active: number;
  total_queued: number;
  total_completed_24h: number;
  total_failed_24h: number;
  avg_execution_time_ms: number;
  system_health: 'healthy' | 'degraded' | 'unhealthy';
}

// ============================================================================
// Workflow List/Registry Types
// ============================================================================

/** Workflow list entry */
export interface WorkflowListEntry {
  workflow_id: string;
  /** Alias for workflow_id (for UI convenience) */
  id?: string;
  name: string;
  description: string;
  version: string;
  phase: WorkflowPhase;
  /** UI-friendly status (alias for phase) */
  status?: 'draft' | 'active' | 'archived';
  created_at: string;
  updated_at: string;
  last_executed_at?: string;
  /** Alias for last_executed_at (for UI convenience) */
  last_executed?: string;
  execution_count: number;
  /** Number of nodes in the workflow */
  node_count?: number;
  tags: string[];
  is_template: boolean;
}

/** Workflow template */
export interface WorkflowTemplate {
  template_id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  preview_nodes: DesignerNode[];
  preview_edges: DesignerEdge[];
}

// ============================================================================
// Executable Workflow Types
// ============================================================================

/** Executable workflow (runtime format) */
export interface ExecutableWorkflow {
  workflow_id: string;
  version: string;
  entry_point: string;
  nodes: ExecutableNode[];
  edges: ExecutableEdge[];
  variables: WorkflowVariable[];
}

/** Executable node (runtime format) */
export interface ExecutableNode {
  id: string;
  type: string;
  config: Record<string, unknown>;
  retry_policy?: RetryPolicy;
  timeout_ms?: number;
}

/** Executable edge (runtime format) */
export interface ExecutableEdge {
  from: string;
  to: string;
  condition?: EdgeCondition;
}

/** Edge condition */
export interface EdgeCondition {
  type: 'always' | 'on_success' | 'on_failure' | 'expression';
  expression?: string;
}

/** Retry policy */
export interface RetryPolicy {
  max_attempts: number;
  backoff_type: 'fixed' | 'linear' | 'exponential';
  backoff_ms: number;
  max_backoff_ms?: number;
}

/** Workflow variable */
export interface WorkflowVariable {
  name: string;
  type: PortType;
  default_value?: unknown;
  required: boolean;
  description?: string;
}
