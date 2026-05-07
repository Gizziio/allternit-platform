/**
 * Allternit Workflow Engine Types
 * 
 * Core type definitions for workflow orchestration.
 */

/**
 * Workflow Definition
 */
export interface Workflow {
  /** Workflow ID */
  id: string;
  /** Workflow name */
  name: string;
  /** Workflow version */
  version: string;
  /** Workflow description */
  description?: string;
  /** Input parameters schema */
  inputs?: ParameterSchema[];
  /** Output parameters schema */
  outputs?: ParameterSchema[];
  /** Workflow variables */
  variables?: Variable[];
  /** Workflow nodes */
  nodes: WorkflowNode[];
  /** Connections between nodes */
  connections: Connection[];
  /** Workflow triggers */
  triggers?: Trigger[];
  /** Error handling strategy */
  errorHandling?: ErrorHandlingConfig;
  /** Workflow metadata */
  metadata?: WorkflowMetadata;
}

/**
 * Workflow Node
 */
export interface WorkflowNode {
  /** Unique node ID */
  id: string;
  /** Node type */
  type: string;
  /** Node name */
  name: string;
  /** Node configuration */
  config?: Record<string, unknown>;
  /** Input mappings */
  inputs?: InputMapping[];
  /** Output mappings */
  outputs?: OutputMapping[];
  /** Node position in visual editor */
  position?: Position;
  /** Node metadata */
  metadata?: NodeMetadata;
}

/**
 * Connection between nodes
 */
export interface Connection {
  /** Connection ID */
  id: string;
  /** Source node ID */
  source: string;
  /** Source output port */
  sourcePort?: string;
  /** Target node ID */
  target: string;
  /** Target input port */
  targetPort?: string;
  /** Condition for this connection */
  condition?: string;
}

/**
 * Parameter Schema
 */
export interface ParameterSchema {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any';
  /** Parameter description */
  description?: string;
  /** Is required */
  required?: boolean;
  /** Default value */
  default?: unknown;
  /** Validation rules */
  validation?: ValidationRule[];
}

/**
 * Validation Rule
 */
export interface ValidationRule {
  /** Rule type */
  type: 'required' | 'min' | 'max' | 'pattern' | 'enum' | 'custom';
  /** Rule value */
  value?: unknown;
  /** Error message */
  message?: string;
}

/**
 * Workflow Variable
 */
export interface Variable {
  /** Variable name */
  name: string;
  /** Variable type */
  type: string;
  /** Initial value */
  default?: unknown;
  /** Is secret */
  secret?: boolean;
  /** Scope */
  scope?: 'workflow' | 'node' | 'global';
}

/**
 * Input Mapping
 */
export interface InputMapping {
  /** Target input name */
  target: string;
  /** Source expression */
  source: string;
  /** Transform expression */
  transform?: string;
  /** Default value if source is empty */
  default?: unknown;
}

/**
 * Output Mapping
 */
export interface OutputMapping {
  /** Source output name */
  source: string;
  /** Target variable or expression */
  target: string;
  /** Transform expression */
  transform?: string;
}

/**
 * Workflow Trigger
 */
export interface Trigger {
  /** Trigger ID */
  id: string;
  /** Trigger type */
  type: 'schedule' | 'webhook' | 'event' | 'manual' | 'api';
  /** Trigger configuration */
  config?: Record<string, unknown>;
  /** Is enabled */
  enabled?: boolean;
}

/**
 * Error Handling Configuration
 */
export interface ErrorHandlingConfig {
  /** Default retry count */
  retryCount?: number;
  /** Default retry delay (ms) */
  retryDelay?: number;
  /** Error handler node ID */
  errorHandler?: string;
  /** Continue on error */
  continueOnError?: boolean;
  /** Max concurrent errors before failing workflow */
  maxErrors?: number;
}

/**
 * Workflow Metadata
 */
export interface WorkflowMetadata {
  /** Created timestamp */
  createdAt?: string;
  /** Updated timestamp */
  updatedAt?: string;
  /** Author */
  author?: string;
  /** Tags */
  tags?: string[];
  /** Category */
  category?: string;
}

/**
 * Node Metadata
 */
export interface NodeMetadata {
  /** Node color */
  color?: string;
  /** Node icon */
  icon?: string;
  /** Documentation URL */
  docs?: string;
}

/**
 * Position in visual editor
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Workflow Execution
 */
export interface WorkflowExecution {
  /** Execution ID */
  id: string;
  /** Workflow ID */
  workflowId: string;
  /** Execution status */
  status: ExecutionStatus;
  /** Input data */
  inputs?: Record<string, unknown>;
  /** Output data */
  outputs?: Record<string, unknown>;
  /** Execution context */
  context?: ExecutionContext;
  /** Node executions */
  nodeExecutions?: NodeExecution[];
  /** Started timestamp */
  startedAt?: string;
  /** Completed timestamp */
  completedAt?: string;
  /** Error information */
  error?: ExecutionError;
}

/**
 * Execution Status
 */
export type ExecutionStatus = 
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

/**
 * Execution Context
 */
export interface ExecutionContext {
  /** Workflow variables */
  variables: Record<string, unknown>;
  /** Execution state */
  state: ExecutionState;
  /** Parent execution ID (for sub-workflows) */
  parentExecutionId?: string;
  /** Trigger information */
  trigger?: TriggerInfo;
  /** User/agent context */
  userContext?: UserContext;
}

/**
 * Execution State
 */
export interface ExecutionState {
  /** Currently executing nodes */
  activeNodes: string[];
  /** Completed nodes */
  completedNodes: string[];
  /** Failed nodes */
  failedNodes: string[];
  /** Node results */
  nodeResults: Record<string, unknown>;
  /** Execution path taken */
  executionPath: string[];
}

/**
 * Node Execution
 */
export interface NodeExecution {
  /** Node ID */
  nodeId: string;
  /** Execution status */
  status: ExecutionStatus;
  /** Input data */
  inputs?: Record<string, unknown>;
  /** Output data */
  outputs?: Record<string, unknown>;
  /** Started timestamp */
  startedAt?: string;
  /** Completed timestamp */
  completedAt?: string;
  /** Retry count */
  retryCount?: number;
  /** Error information */
  error?: ExecutionError;
}

/**
 * Execution Error
 */
export interface ExecutionError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error details */
  details?: unknown;
  /** Stack trace */
  stack?: string;
  /** Node ID where error occurred */
  nodeId?: string;
}

/**
 * Trigger Information
 */
export interface TriggerInfo {
  /** Trigger type */
  type: string;
  /** Trigger ID */
  triggerId: string;
  /** Trigger data */
  data?: unknown;
  /** Timestamp */
  timestamp: string;
}

/**
 * User Context
 */
export interface UserContext {
  /** User ID */
  userId?: string;
  /** Organization ID */
  orgId?: string;
  /** Roles */
  roles?: string[];
  /** Permissions */
  permissions?: string[];
}

/**
 * Node Type Definition
 */
export interface NodeType {
  /** Node type ID */
  type: string;
  /** Node category */
  category: NodeCategory;
  /** Display name */
  displayName: string;
  /** Description */
  description?: string;
  /** Input ports */
  inputs?: PortDefinition[];
  /** Output ports */
  outputs?: PortDefinition[];
  /** Configuration schema */
  configSchema?: ParameterSchema[];
  /** Default configuration */
  defaultConfig?: Record<string, unknown>;
  /** Node executor */
  executor?: NodeExecutor;
  /** Icon */
  icon?: string;
  /** Color */
  color?: string;
}

/**
 * Node Category
 */
export type NodeCategory =
  | 'input'
  | 'output'
  | 'transform'
  | 'condition'
  | 'loop'
  | 'delay'
  | 'http'
  | 'database'
  | 'ai'
  | 'custom';

/**
 * Port Definition
 */
export interface PortDefinition {
  /** Port name */
  name: string;
  /** Port type */
  type: string;
  /** Is required */
  required?: boolean;
  /** Description */
  description?: string;
}

/**
 * Node Executor Function
 */
export type NodeExecutor = (
  node: WorkflowNode,
  context: ExecutionContext,
  inputs: Record<string, unknown>
) => Promise<Record<string, unknown>>;

/**
 * Workflow Engine Configuration
 */
export interface WorkflowEngineConfig {
  /** Max concurrent executions */
  maxConcurrentExecutions?: number;
  /** Default execution timeout (ms) */
  defaultTimeout?: number;
  /** Enable execution history */
  enableHistory?: boolean;
  /** History retention (days) */
  historyRetentionDays?: number;
  /** Custom node types */
  nodeTypes?: NodeType[];
  /** Hooks */
  hooks?: WorkflowHooks;
}

/**
 * Workflow Hooks
 */
export interface WorkflowHooks {
  /** Before workflow execution */
  beforeExecute?: (execution: WorkflowExecution) => Promise<void>;
  /** After workflow execution */
  afterExecute?: (execution: WorkflowExecution) => Promise<void>;
  /** Before node execution */
  beforeNodeExecute?: (node: WorkflowNode, context: ExecutionContext) => Promise<void>;
  /** After node execution */
  afterNodeExecute?: (node: WorkflowNode, context: ExecutionContext, result: unknown) => Promise<void>;
  /** On error */
  onError?: (error: ExecutionError, context: ExecutionContext) => Promise<void>;
}
