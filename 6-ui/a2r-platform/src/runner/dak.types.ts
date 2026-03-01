/**
 * DAK Runner Types - Complete type system for Deterministic Agent Kernel
 * 
 * These types mirror the DAK Runner backend (1-kernel/dak-runner)
 */

// ============================================================================
// DAG Types
// ============================================================================

export type DagNodeStatus = "pending" | "running" | "completed" | "failed" | "blocked" | "skipped";
export type DagEdgeType = "hard" | "soft";

export interface DagNode {
  id: string;
  type: string;  // builder, validator, orchestrator, etc.
  title: string;
  description?: string;
  status: DagNodeStatus;
  agentId?: string;
  leaseId?: string;
  wihId?: string;
  startedAt?: number;
  completedAt?: number;
  outputs?: string[];
  policyMarkerId?: string;
  contextPackId?: string;
  // Runtime state
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
}

export interface DagEdge {
  from: string;
  to: string;
  type: DagEdgeType;
}

export interface DagDefinition {
  dagId: string;
  version: string;
  createdAt: string;
  nodes: DagNode[];
  edges: DagEdge[];
  metadata?: {
    title?: string;
    description?: string;
    createdBy?: string;
    tags?: string[];
  };
}

export interface DagExecution {
  runId: string;
  dagId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startedAt: number;
  completedAt?: number;
  currentNodeId?: string;
  completedNodes: string[];
  failedNodes: string[];
  blockedNodes: string[];
  progress: number;  // 0-100
}

export interface DagPlanRequest {
  text: string;
  dagId?: string;
  parentDagId?: string;
  agentId?: string;
}

export interface DagPlanResponse {
  dagId: string;
  promptId: string;
  rootNodeId: string;
  estimatedNodes: number;
}

export interface DagRefineRequest {
  dagId: string;
  delta: string;
  reason?: string;
  mutations?: DagMutation[];
}

export interface DagMutation {
  action: "add" | "remove" | "modify" | "set_status";
  nodeId?: string;
  parentId?: string;
  afterNodeId?: string;
  title?: string;
  description?: string;
  status?: DagNodeStatus;
}

// ============================================================================
// WIH (Work In Hand) Types
// ============================================================================

export type WihStatus = "open" | "signed" | "closed" | "archived";

export interface WihInfo {
  wihId: string;
  nodeId: string;
  dagId: string;
  status: WihStatus;
  title?: string;
  description?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  signedAt?: string;
  closedAt?: string;
  contextPackId?: string;
  // For pickup
  ready: boolean;
  blockedBy: string[];
}

export interface WihPickupRequest {
  dagId: string;
  nodeId: string;
  agentId: string;
  role?: string;
  fresh?: boolean;
}

export interface WihPickupResponse {
  wihId: string;
  contextPackPath?: string;
  leaseId?: string;
}

export interface WihCloseRequest {
  wihId: string;
  status: "completed" | "failed" | "cancelled";
  evidence?: string[];
  contextPackId?: string;
}

// ============================================================================
// Lease Types
// ============================================================================

export type LeaseStatus = "active" | "expiring" | "expired" | "released";

export interface ManagedLease {
  leaseId: string;
  wihId: string;
  dagId: string;
  nodeId: string;
  agentId: string;
  acquiredAt: number;
  expiresAt: number;
  keys: string[];  // File paths, resources
  tools: string[];  // Allowed tools
  renewalCount: number;
  status: LeaseStatus;
  lastRenewalAt?: number;
  releasedAt?: number;
}

export interface LeaseRequest {
  wihId: string;
  agentId: string;
  paths: string[];
  tools?: string[];
  ttlSeconds?: number;
}

export interface LeaseResponse {
  leaseId: string;
  granted: boolean;
  expiresAt?: number;
  error?: string;
}

// ============================================================================
// Context Pack Types
// ============================================================================

export interface ContextPack {
  contextPackId: string;  // SHA-256 hash
  version: string;
  createdAt: string;
  inputs: ContextPackInputs;
  correlationId: string;
  // Optional parsed content
  content?: {
    plan?: string;
    todo?: string;
    progress?: string;
    findings?: string;
  };
}

export interface ContextPackInputs {
  wihId: string;
  dagId: string;
  nodeId: string;
  wihContent?: string;
  dagSlice?: DagSlice;
  receiptRefs: string[];
  policyBundleId?: string;
  planHashes?: Record<string, string>;
  toolRegistryVersion?: string;
  leaseInfo?: LeaseInfo;
}

export interface DagSlice {
  node: DagNode;
  hardDeps: DagNode[];
  ancestors: DagNode[];
  edges: DagEdge[];
}

export interface LeaseInfo {
  leaseId: string;
  keys: string[];
  expiresAt: number;
}

export interface ContextPackSealResponse {
  sealed: boolean;
  contextPackId: string;
  storedAt: string;
}

export interface ContextPackQuery {
  dagId?: string;
  nodeId?: string;
  wihId?: string;
  correlationId?: string;
  limit?: number;
}

// ============================================================================
// Receipt Types
// ============================================================================

export type ReceiptKind = 
  | "tool_call_post" 
  | "validator_report" 
  | "build_report"
  | "gate_decision"
  | "session_start"
  | "dag_load"
  | "node_entry"
  | "context_pack_sealed";

export interface Receipt {
  receiptId: string;
  kind: ReceiptKind;
  runId: string;
  dagId: string;
  nodeId: string;
  wihId: string;
  timestamp: string;
  payload: unknown;
  signature?: string;  // For verification
}

export interface ReceiptQuery {
  dagId?: string;
  nodeId?: string;
  wihId?: string;
  kinds?: ReceiptKind[];
  since?: string;
  until?: string;
  limit?: number;
}

// ============================================================================
// Gate/Policy Types
// ============================================================================

export type GateDecision = "allow" | "block" | "review";

export interface GateCheck {
  checkId: string;
  wihId: string;
  dagId: string;
  nodeId: string;
  runId: string;
  tool: ToolCall;
  decision: GateDecision;
  reason?: string;
  policyRuleId?: string;
  timestamp: string;
  leaseId?: string;
  contextPackId?: string;
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  intendedPaths?: string[];
}

export interface GateRules {
  version: string;
  rules: GateRule[];
}

export interface GateRule {
  id: string;
  name: string;
  pattern: string;  // Regex or glob
  action: GateDecision;
  description?: string;
}

// ============================================================================
// Policy Marker Types
// ============================================================================

export type InjectionPoint = "session_start" | "dag_load" | "node_entry" | "tool_invoke";

export interface PolicyMarker {
  markerId: string;
  bundleId: string;
  injectionPoint: InjectionPoint;
  timestamp: string;
  signature: string;
  dagId?: string;
  nodeId?: string;
  runId?: string;
  agentId?: string;
}

// ============================================================================
// Tool Snapshot Types
// ============================================================================

export interface ToolSnapshot {
  snapshotId: string;  // SHA-256 of content
  toolName: string;
  request: unknown;
  response: unknown;
  timestamp: string;
  ttl?: number;
  hitCount: number;
}

export interface SnapshotStats {
  totalSnapshots: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  oldestSnapshot: string;
  newestSnapshot: string;
}

// ============================================================================
// Prompt Template (PFS v1) Types
// ============================================================================

export type TemplateCategory = 
  | "core" 
  | "roles" 
  | "orchestration" 
  | "planning" 
  | "cleanup" 
  | "control_flow" 
  | "evidence";

export interface PromptTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  template: string;
  variables: TemplateVariable[];
  version: string;
  tags: string[];
}

export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
  type: "string" | "number" | "boolean" | "array" | "object";
}

export interface TemplateExecutionRequest {
  templateId: string;
  variables: Record<string, unknown>;
  dagId?: string;
  nodeId?: string;
}

// ============================================================================
// DAK Runner State
// ============================================================================

export interface DakRunnerState {
  // Connection
  railsConnected: boolean;
  railsUrl: string;
  
  // DAG Execution
  activeDag?: DagExecution;
  dagHistory: DagExecution[];
  
  // Leases
  activeLeases: ManagedLease[];
  leaseHistory: ManagedLease[];
  
  // WIHs
  activeWihs: WihInfo[];
  myWihs: WihInfo[];  // Assigned to current agent
  
  // Context
  recentContextPacks: ContextPack[];
  
  // Monitoring
  pendingGateChecks: GateCheck[];
  recentReceipts: Receipt[];
  
  // Snapshots
  snapshotStats?: SnapshotStats;
}

// ============================================================================
// Events
// ============================================================================

export type DakEventType = 
  | "dag:started"
  | "dag:completed"
  | "node:started"
  | "node:completed"
  | "node:failed"
  | "lease:acquired"
  | "lease:renewed"
  | "lease:expiring"
  | "lease:expired"
  | "lease:released"
  | "wih:created"
  | "wih:assigned"
  | "wih:completed"
  | "gate:check"
  | "gate:decision"
  | "context_pack:sealed"
  | "receipt:written";

export interface DakEvent {
  id: string;
  type: DakEventType;
  timestamp: number;
  dagId?: string;
  nodeId?: string;
  wihId?: string;
  leaseId?: string;
  payload: unknown;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface DakApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface DakHealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  railsConnected: boolean;
  activeDags: number;
  activeLeases: number;
  uptime: number;
}
