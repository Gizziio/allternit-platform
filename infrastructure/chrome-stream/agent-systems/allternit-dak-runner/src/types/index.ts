/**
 * Core types for DAK Runner
 */

// Identifier types
export type DagId = `dag_${string}`;
export type NodeId = `n_${string}`;
export type WihId = `wih_${string}`;
export type RunId = `run_${string}`;
export type IterationId = `it_${number}`;
export type AgentId = string;
export type CorrelationId = `corr_${string}`;
export type LeaseId = `lease_${string}`;
export type ReceiptId = `rcpt_${string}`;
export type ContextPackId = `cp_${string}`;
export type PolicyBundleId = `pb_${string}`;

// Execution modes
export type ExecutionMode = 
  | 'PLAN_ONLY' 
  | 'REQUIRE_APPROVAL' 
  | 'ACCEPT_EDITS' 
  | 'BYPASS_PERMISSIONS';

// Roles
export type Role = 
  | 'orchestrator' 
  | 'builder' 
  | 'validator' 
  | 'reviewer' 
  | 'security' 
  | 'planner';

// Gate decisions
export type GateDecision = 'ALLOW' | 'BLOCK' | 'TRANSFORM' | 'REQUIRE_APPROVAL';

// Tool definitions
export interface Tool {
  name: string;
  description: string;
  inputSchema: object;
  outputSchema?: object;
  dangerous?: boolean;
  modifiesFilesystem?: boolean;
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  correlationId: CorrelationId;
  intendedPaths?: string[];
}

export interface ToolResult {
  success: boolean;
  output?: unknown;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: {
    message: string;
    code: string;
    stderr?: string;
  };
  affectedPaths?: string[];
  producedHashes?: string[];
}

// Hook events (Claude parity)
export type HookEventType =
  | 'SessionStart'
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'PermissionRequest'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'Notification'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'Stop'
  | 'TeammateIdle'
  | 'TaskCompleted'
  | 'PreCompact'
  | 'SessionEnd';

export interface HookEvent {
  type: HookEventType;
  timestamp: string;
  runId: RunId;
  correlationId: CorrelationId;
  payload: unknown;
}

export interface SessionStartPayload {
  reason: 'startup' | 'resume' | 'clear' | 'compact';
  wihId: WihId;
  dagId: DagId;
  nodeId: NodeId;
  role: Role;
}

export interface PreToolUsePayload {
  toolCall: ToolCall;
  contextPackId: ContextPackId;
  policyBundleId: PolicyBundleId;
}

export interface PostToolUsePayload {
  toolCall: ToolCall;
  result: ToolResult;
  gateDecision: GateDecision;
  receiptId: ReceiptId;
}

export interface PostToolUseFailurePayload {
  toolCall: ToolCall;
  error: ToolResult['error'];
  receiptId: ReceiptId;
}

// Context Pack
export interface ContextPack {
  contextPackId: ContextPackId;
  version: string;
  createdAt: string;
  inputs: {
    wihId: WihId;
    dagId: DagId;
    nodeId: NodeId;
    receiptRefs: ReceiptId[];
    policyBundleId: PolicyBundleId;
    planHashes: Record<string, string>;
  };
  correlationId: CorrelationId;
}

// Lease
export interface Lease {
  leaseId: LeaseId;
  wihId: WihId;
  dagId: DagId;
  nodeId: NodeId;
  holder: AgentId;
  grantedAt: string;
  expiresAt: string;
  scope: {
    paths: string[];
    tools: string[];
  };
}

// Receipts
export type ReceiptKind =
  | 'injection_marker'
  | 'context_pack_seal'
  | 'tool_call_pre'
  | 'tool_call_post'
  | 'tool_call_failure'
  | 'policy_decision'
  | 'validator_report'
  | 'compaction_summary'
  | 'build_report';

export interface Receipt {
  receiptId: ReceiptId;
  kind: ReceiptKind;
  runId: RunId;
  dagId: DagId;
  nodeId: NodeId;
  wihId: WihId;
  provenance: {
    agentId: AgentId;
    role: Role;
    iterationId: IterationId;
  };
  inputs: {
    contextPackId: ContextPackId;
    policyBundleId: PolicyBundleId;
  };
  payload: unknown;
  createdAt: string;
  correlationId: CorrelationId;
}

// Work Request from Rails
export interface WorkRequest {
  requestId: string;
  dagId: DagId;
  nodeId: NodeId;
  wihId: WihId;
  role: Role;
  executionMode: ExecutionMode;
  priority: number;
  depsSatisfied: boolean;
  requiredGates: string[];
  requiredEvidence: string[];
  leaseRequired: boolean;
  leaseScope: {
    allowedPaths: string[];
    allowedTools: string[];
  };
  createdAt: string;
  correlationId: CorrelationId;
}

// PolicyConstraints is defined in policy/bundle-builder.ts (snake_case fields)
// Re-export for convenience
export type { PolicyConstraints } from '../policy/bundle-builder';
