/**
 * Minimal local contracts for the UI skeleton.
 * These are NOT the full spec system; they are build-now interfaces.
 */

export type Id = string;

export type ToolScope = "read" | "write" | "exec";

export interface JournalEvent {
  id: Id;
  ts: number;              // epoch ms
  kind: string;            // e.g. "intent", "canvas_spawn", "note"
  payload: Record<string, unknown>;
  parents?: Id[];
}

export interface CanvasSpec {
  canvasId: Id;
  title: string;
  views: ViewSpec[];
}

export type ViewType =
  | "timeline_view"
  | "object_view"
  | "table_view"
  | "list_view"
  | "graph_view"
  | "provenance_view"
  | "explanation_view"
  | "workflow_view"
  | "iframe_view"
  | "search_lens"
  | "browser_view"

export interface ViewSpec {
  viewId: Id;
  type: ViewType;
  title?: string;
  entity?: string;
  bindings: {
    journalRefs?: Id[];
    query?: {
      filter?: Record<string, unknown>;
      sort?: Array<{ field: string; dir: "asc" | "desc" }>;
      limit?: number;
    };
  };
  // Definition for Table/Queue views
  columns?: Array<{
    field: string;
    label: string;
    type?: "text" | "number" | "date" | "status" | "user";
  }>;
  // Definition for Actionable views
  actions?: Array<{
    id: string;
    label: string;
    policy?: string;
    icon?: string;
  }>;
  // Definition for Form/Detail views
  layout?: {
    sections: Array<{
      title: string;
      fields: Array<string>; // field IDs from schema
    }>;
  };
  data?: Record<string, unknown>;
}

export interface MiniAppManifest {
  appId: Id;
  name: string;
  data_models: Record<string, unknown>; // Schema definitions
  views: Record<string, ViewSpec>;      // Pre-defined views
  actions: Record<string, unknown>;     // Action definitions
  permissions?: string[];
}

export interface ActionRequest {
  actionId: string;
  capsuleId: string;
  viewId: string;
  context: Record<string, unknown>; // e.g. { itemId: "WO-101" }
  payload?: Record<string, unknown>; // form data
}

export interface ActionResponse {
  success: boolean;
  message?: string;
  events: KernelJournalEvent[];
  stateUpdates?: Record<string, unknown>;
}

export interface CapsuleInstance {
  capsuleId: Id;
  frameworkId: Id;
  title: string;
  createdAt: number;
  state: Record<string, unknown>;
  activeCanvasId?: Id;
  persistenceMode: "ephemeral" | "docked" | "pinned";
  sandbox_policy?: {
    allow_network: boolean;
    allow_filesystem: boolean;
    max_memory_mb: number;
  };
  tool_scope?: {
    allowed_tools: string[];
    denied_tools: string[];
    requires_confirmation: string[];
  };
}

export interface FrameworkSpec {
  frameworkId: Id;
  version: string;
  status: "draft" | "candidate" | "active" | "deprecated";
  capsuleTemplate: {
    capsuleType: string;
    defaultCanvases: Array<{
      viewType: string;
      title: string;
      initialState?: Record<string, unknown>;
    }>;
  };
  requiredTools: Array<{
    toolId: string;
    scope: string;
  }>;
  directives: string[];
  evalSuite: string[];
  promotionRules?: string;
}

export interface KernelCapsuleResponse {
  capsule: CapsuleInstance;
  canvases: Array<{
    canvasId: string;
    capsuleId: string;
    viewType: string;
    title: string;
    state: Record<string, unknown>;
  }>;
  events: Array<{
    eventId: string;
    timestamp: number;
    kind: string;
    capsuleId?: string;
    payload: Record<string, unknown>;
  }>;
  artifacts: Array<{
    artifactId: string;
    capsuleId: string;
    artifactType: string;
    content: Record<string, unknown>;
  }>;
}

export interface KernelJournalEvent {
  eventId: string;
  timestamp: number;
  kind: string;
  capsuleId?: string;
  payload: Record<string, unknown>;
}

// Intent Graph Kernel Types
export type NodeId = string;

export enum NodeType {
  Intent = "intent",
  Task = "task",
  Goal = "goal",
  Decision = "decision",
  Plan = "plan",
  Artifact = "artifact",
  Memory = "memory",
}

export enum EdgeType {
  DependsOn = "depends_on",
  Blocks = "blocks",
  PartOf = "part_of",
  Implements = "implements",
  ContextFor = "context_for",
}

export enum NodeStatus {
  Proposed = "proposed",
  Active = "active",
  Completed = "completed",
  Deprecated = "deprecated",
}

export interface IGKNode {
  nodeId: NodeId;
  nodeType: NodeType;
  status: NodeStatus;
  priority: number;
  owner: string;
  sourceRefs: IGKSourceRef[];
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IGKEdge {
  edgeId: string;
  fromNodeId: NodeId;
  toNodeId: NodeId;
  edgeType: EdgeType;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface IGKEvent {
  eventId: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  policyDecision?: string;
}

export interface IGKSourceRef {
  kind: string;
  locator: string;
  excerpt?: string;
  hash?: string;
}

export interface ContextSlice {
  rootNodes: NodeId[];
  edges: string[];
  sources: IGKSourceRef[];
  tokenBudget: number;
}

export interface TemporalProjections {
  now: IGKNode[];
  next: IGKNode[];
  later: IGKNode[];
}

export interface ContextWindow {
  nodes: IGKNode[];
  tokenCount: number;
  budget: number;
  withinBudget: boolean;
}

// Capsule Runtime Types
export type CapsuleId = string;

export enum PersistenceMode {
  Ephemeral = "ephemeral",
  Session = "session",
  Pinned = "pinned",
  Archived = "archived",
}

export enum FileSystemMode {
  Deny = "deny",
  ReadOnly = "ro",
  ReadWrite = "rw",
}

export interface CapsuleSandboxPolicy {
  allow_network: boolean;
  allow_filesystem: boolean;
  max_memory_mb: number;
}

export interface CapsuleRuntimeState {
  capsuleId: string;
  status: PersistenceMode;
  runtime_state: "active" | "paused" | "closed";
}

export interface CapsuleSpec {
  capsuleId: CapsuleId;
  title: string;
  icon: string;
  category: string;
  status: PersistenceMode;
  runRef: {
    runId: string;
    sessionId: string;
  };
  bindings: {
    journalRefs: CapsuleId[];
    repoSnapshotRef?: string;
    artifactRefs: CapsuleId[];
  };
  canvasBundle: CapsuleCanvasBundle[];
  toolScope: CapsuleToolScope;
  sandboxPolicy: CapsuleSandboxPolicy;
  lifecycle: {
    closeBehavior?: string;
    exportable: boolean;
  };
  provenance: CapsuleProvenance;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface CapsuleCanvasBundle {
  canvasId: CapsuleId;
  viewType: string;
  bindings: any;
  interactions?: string[];
  risk: "read" | "write" | "exec";
  provenanceUI: {
    showTrail: boolean;
  };
}

export interface CapsuleToolScope {
  allowedTools: string[];
  deniedTools: string[];
  requiresConfirmation: string[];
}

export interface CapsuleProvenance {
  frameworkId: CapsuleId;
  frameworkVersion: string;
  agentId: string;
  modelId: string;
  inputs: CapsuleInputRef[];
  toolCalls: string[];
}

export interface CapsuleInputRef {
  type: string;
  refId: CapsuleId;
  redacted: boolean;
}

export interface AssistantIdentity {
  id: string;
  name: string;
  persona: string;
  preferences: Record<string, unknown>;
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  action_payload: Record<string, unknown>;
  priority: string;
}

export interface AgentPublisher {
  publisher_id: string;
  public_key_id: string;
}

export interface AgentSignature {
  manifest_sig: string;
  bundle_hash: string;
}

export interface AgentSpec {
  id: string;
  role: string;
  description: string;
  tools: string[];
  policies: string[];
  publisher: AgentPublisher;
  signature: AgentSignature;
}

export type SafetyTier = "T0" | "T1" | "T2" | "T3" | "T4";

export type ToolType = "Local" | "Http" | "Mpc" | "Sdk";

export type NetworkAccess = "None" | "Unrestricted" | { DomainAllowlist: string[] };

export type FilesystemAccess = "None" | { Allowlist: string[] } | { ReadWrite: string[] };

export interface ToolResourceLimits {
  cpu?: string | null;
  memory?: string | null;
  network: NetworkAccess;
  filesystem: FilesystemAccess;
  time_limit: number;
}

export interface ToolGatewayDefinition {
  id: string;
  name: string;
  description: string;
  tool_type: ToolType;
  command: string;
  endpoint: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  side_effects: string[];
  idempotency_behavior: string;
  retryable: boolean;
  failure_classification: string;
  safety_tier: SafetyTier;
  resource_limits: ToolResourceLimits;
}

export interface ToolExecuteEnvelope {
  input: Record<string, unknown>;
  identity_id?: string;
  session_id?: string;
  tenant_id?: string;
  trace_id?: string;
  idempotency_key?: string;
  retry_count?: number;
}

export type ToolExecutePayload = ToolExecuteEnvelope | Record<string, unknown>;

export interface ToolExecutionResult {
  execution_id: string;
  tool_id: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  error?: string | null;
  stdout: string;
  stderr: string;
  exit_code?: number | null;
  execution_time_ms: number;
  resources_used: {
    cpu_time_ms: number;
    memory_peak_kb: number;
    network_bytes: number;
    filesystem_ops: number;
  };
  timestamp: number;
}

export interface SkillPackage {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  installed: boolean;
}

export interface SkillIO {
  schema: string;
  examples?: Record<string, unknown>[];
}

export interface SkillRuntime {
  mode: "Sandbox" | "Host" | "Container";
  timeouts: {
    per_step?: number;
    total?: number;
  };
  resources?: {
    cpu?: string | null;
    gpu?: string | null;
    memory?: string | null;
  };
}

export interface SkillEnvironment {
  allowed_envs: Array<"Dev" | "Stage" | "Prod">;
  network: NetworkAccess;
  filesystem: FilesystemAccess;
}

export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  tags: string[];
  homepage?: string | null;
  repository?: string | null;
  inputs: SkillIO;
  outputs: SkillIO;
  runtime: SkillRuntime;
  environment: SkillEnvironment;
  side_effects: string[];
  risk_tier: SafetyTier;
  required_permissions: string[];
  requires_policy_gate: boolean;
  publisher: {
    publisher_id: string;
    public_key_id: string;
  };
  signature: {
    manifest_sig: string;
    bundle_hash: string;
  };
}

export interface SkillWorkflow {
  nodes: Array<{
    id: string;
    name: string;
    phase: string;
    tool_binding: string;
    inputs: string[];
    outputs: string[];
  }>;
  edges: Array<{
    from: string;
    to: string;
    condition?: string | null;
  }>;
  per_node_constraints: Record<string, unknown>;
  artifact_outputs: string[];
}

export interface Skill {
  manifest: SkillManifest;
  workflow: SkillWorkflow;
  tools: ToolGatewayDefinition[];
  human_routing: string;
}

export interface PublisherKey {
  publisher_id: string;
  public_key_id: string;
  public_key: string;
  created_at: number;
  revoked: boolean;
  revoked_at?: number | null;
}

export interface PublisherKeyRegistrationRequest {
  publisher_id: string;
  public_key_id: string;
  public_key: string;
}

export interface PublisherKeyRevokeRequest {
  public_key_id: string;
}

export type WorkflowPhase =
  | "Observe"
  | "Think"
  | "Plan"
  | "Build"
  | "Execute"
  | "Verify"
  | "Learn";

export type WorkflowStatus = "Pending" | "Running" | "Completed" | "Failed" | "Stopped";

export type WorkflowNodeStatus = "Pending" | "Running" | "Completed" | "Failed" | "Skipped";

export interface WorkflowNode {
  id: string;
  name: string;
  phase: WorkflowPhase;
  skill_id: string;
  inputs: string[];
  outputs: string[];
  constraints: {
    time_budget?: number | null;
    resource_limits?: ToolResourceLimits | null;
    allowed_tools: string[];
    required_permissions: string[];
  };
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: string | null;
}

export interface WorkflowDefinition {
  workflow_id: string;
  version: string;
  description: string;
  required_roles: string[];
  allowed_skill_tiers: SafetyTier[];
  phases_used: WorkflowPhase[];
  success_criteria: string;
  failure_modes: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowExecution {
  execution_id: string;
  workflow_id: string;
  session_id: string;
  tenant_id: string;
  start_time: number;
  end_time?: number | null;
  status: WorkflowStatus;
  current_phase?: WorkflowPhase | null;
  node_results: Record<string, NodeResult>;
  artifacts: string[];
  trace_id?: string | null;
}

export interface NodeResult {
  node_id: string;
  status: WorkflowNodeStatus;
  output?: Record<string, unknown> | null;
  error?: string | null;
  execution_time_ms: number;
  artifacts_produced: string[];
  timestamp: number;
}

export interface ArtifactMetadata {
  artifact_id: string;
  name: string;
  version: string;
  artifact_type: string;
  description: string;
  author: string;
  license: string;
  tags: string[];
  created_at: number;
  updated_at: number;
  published_at?: number | null;
  deprecated_at?: number | null;
  download_count: number;
  trust_score: number;
}

export interface ArtifactQueryResponse {
  query_id: string;
  artifacts: ArtifactMetadata[];
  total_count: number;
  returned_count: number;
  timestamp: number;
  trace_id?: string | null;
}

export interface TemplateIndex {
  agents: AgentSpec[];
  workflows: WorkflowDefinition[];
  pipelines: Array<Record<string, unknown>>;
}

export interface PatternSpec {
  patternId: string;
  intentClass: string;
  triggerSignals: string[];
  inputsSchema: Record<string, unknown>;
  toolPlanTemplate: Record<string, unknown>;
  controlFlow: Record<string, unknown>;
  guardrails: Record<string, unknown>;
  evalSuite: string[];
  status: "draft" | "tested" | "active" | "deprecated";
  reliability: number;
  sampleCount: number;
}

export interface VerificationResult {
  patternId: string;
  reliability: number;
  testsPassed: boolean;
  sampleCount: number;
}

export interface ActionProposal {
  description: string;
  type: string;
  call_id?: string;
  args?: any;
}
