/**
 * Policy & Governance Types
 * 
 * TypeScript interfaces for policy management, gating, purpose binding,
 * and security monitoring.
 */

// ============================================================================
// Policy Types
// ============================================================================

export type PolicyType = 'security' | 'compliance' | 'operational' | 'data' | 'access';
export type PolicySeverity = 'critical' | 'high' | 'medium' | 'low';
type PolicyStatus = 'active' | 'disabled' | 'draft';
export type EnforcementMode = 'block' | 'warn' | 'audit' | 'allow';

export interface Policy {
  id: string;
  name: string;
  description: string;
  type: PolicyType;
  severity: PolicySeverity;
  status: PolicyStatus;
  enforcementMode: EnforcementMode;
  rules: PolicyRule[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
  tags: string[];
  appliesTo: PolicyScope;
  violationCount: number;
  lastViolationAt?: string;
}

interface PolicyRule {
  id: string;
  name: string;
  condition: RuleCondition;
  action: RuleAction;
  priority: number;
  enabled: boolean;
}

interface RuleCondition {
  type: 'threshold' | 'regex' | 'list' | 'time' | 'composite';
  field?: string;
  operator?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'matches' | 'in';
  value?: unknown;
  conditions?: RuleCondition[];
  logic?: 'and' | 'or';
}

interface RuleAction {
  type: 'block' | 'allow' | 'log' | 'alert' | 'escalate' | 'mask';
  parameters?: Record<string, unknown>;
  message?: string;
}

interface PolicyScope {
  agents?: string[];
  agentTypes?: string[];
  tools?: string[];
  resources?: string[];
  workspaces?: string[];
}

export interface CreatePolicyInput {
  name: string;
  description: string;
  type: PolicyType;
  severity: PolicySeverity;
  enforcementMode: EnforcementMode;
  rules: Omit<PolicyRule, 'id'>[];
  tags?: string[];
  appliesTo?: PolicyScope;
}

export interface UpdatePolicyInput extends Partial<CreatePolicyInput> {
  status?: PolicyStatus;
}

// ============================================================================
// Policy Violation Types
// ============================================================================

type ViolationStatus = 'open' | 'resolved' | 'dismissed' | 'escalated';

export interface PolicyViolation {
  id: string;
  policyId: string;
  policyName: string;
  policyType: PolicyType;
  severity: PolicySeverity;
  status: ViolationStatus;
  agentId?: string;
  agentName?: string;
  sessionId?: string;
  runId?: string;
  taskId?: string;
  toolCall?: ToolCallInfo;
  context: ViolationContext;
  evidence: ViolationEvidence[];
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
}

interface ToolCallInfo {
  tool: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

interface ViolationContext {
  userId?: string;
  workspaceId?: string;
  environment?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface ViolationEvidence {
  type: 'log' | 'screenshot' | 'code' | 'data' | 'message';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Approval Workflow Types
// ============================================================================

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
export type ApprovalType = 'tool_execution' | 'file_access' | 'policy_override' | 'deployment' | 'data_export';

export interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  status: ApprovalStatus;
  title: string;
  description: string;
  requester: RequesterInfo;
  resource: ApprovalResource;
  policyId?: string;
  policyName?: string;
  reviewers: string[];
  decisions: ApprovalDecision[];
  requiredApprovals: number;
  currentApprovals: number;
  createdAt: string;
  expiresAt: string;
  completedAt?: string;
  timeout: number;
  escalationLevel: number;
  metadata?: Record<string, unknown>;
}

interface RequesterInfo {
  agentId: string;
  agentName: string;
  userId?: string;
  sessionId?: string;
  runId?: string;
}

interface ApprovalResource {
  type: string;
  identifier: string;
  details?: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface ApprovalDecision {
  reviewerId: string;
  reviewerName?: string;
  decision: 'approved' | 'rejected';
  note?: string;
  timestamp: string;
}

export interface SubmitApprovalInput {
  requestId: string;
  approved: boolean;
  note?: string;
}

// ============================================================================
// Purpose Binding Types
// ============================================================================

export interface Purpose {
  id: string;
  name: string;
  description: string;
  category: string;
  allowedTools: string[];
  allowedResources: string[];
  restrictions: PurposeRestriction[];
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'inactive';
  agentBindings: AgentPurposeBinding[];
}

interface PurposeRestriction {
  type: 'tool' | 'resource' | 'time' | 'data';
  target: string;
  allowed: boolean;
  conditions?: Record<string, unknown>;
}

export interface AgentPurposeBinding {
  agentId: string;
  agentName: string;
  purposeId: string;
  purposeName: string;
  confidence: number;
  boundAt: string;
  boundBy: string;
  status: 'active' | 'suspended' | 'revoked';
  violations: number;
  lastActivityAt?: string;
}

export interface PurposeViolation {
  id: string;
  purposeId: string;
  purposeName: string;
  agentId: string;
  agentName: string;
  violation: string;
  details: Record<string, unknown>;
  severity: PolicySeverity;
  createdAt: string;
  resolvedAt?: string;
}

export interface BindAgentToPurposeInput {
  agentId: string;
  purposeId: string;
  confidence?: number;
  notes?: string;
}

// ============================================================================
// Security Event Types
// ============================================================================

export type SecurityEventType = 
  | 'authentication' 
  | 'authorization' 
  | 'policy_violation' 
  | 'anomaly' 
  | 'threat' 
  | 'compliance' 
  | 'system';

export type SecurityEventSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  subtype: string;
  severity: SecurityEventSeverity;
  title: string;
  description: string;
  source: EventSource;
  target?: EventTarget;
  context: SecurityContext;
  metadata: Record<string, unknown>;
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
}

interface EventSource {
  agentId?: string;
  agentName?: string;
  userId?: string;
  ip?: string;
  sessionId?: string;
}

interface EventTarget {
  type: string;
  identifier: string;
  resource?: string;
}

interface SecurityContext {
  environment: string;
  timestamp: string;
  correlationId: string;
  parentEventId?: string;
}

// ============================================================================
// Compliance Types
// ============================================================================

export interface ComplianceStatus {
  overall: 'compliant' | 'at_risk' | 'non_compliant' | 'unknown';
  score: number;
  lastAssessmentAt: string;
  frameworks: FrameworkCompliance[];
  controls: ControlStatus[];
}

interface FrameworkCompliance {
  id: string;
  name: string;
  version: string;
  status: 'compliant' | 'at_risk' | 'non_compliant';
  score: number;
  totalControls: number;
  passedControls: number;
  failedControls: number;
}

interface ControlStatus {
  id: string;
  name: string;
  framework: string;
  status: 'passed' | 'failed' | 'unknown' | 'not_applicable';
  lastCheckedAt: string;
  evidence?: string;
  policyIds: string[];
}

// ============================================================================
// Security Dashboard Types
// ============================================================================

export interface SecurityOverview {
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  activeAlerts: number;
  unresolvedViolations: number;
  pendingApprovals: number;
  recentEvents: SecurityEvent[];
  complianceStatus: ComplianceStatus;
  metrics: SecurityMetrics;
}

interface SecurityMetrics {
  totalViolations24h: number;
  blockedActions24h: number;
  approvedRequests24h: number;
  rejectedRequests24h: number;
  avgResponseTimeMs: number;
  policyEnforcementRate: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ListPoliciesResponse {
  policies: Policy[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListViolationsResponse {
  violations: PolicyViolation[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListApprovalsResponse {
  requests: ApprovalRequest[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListPurposesResponse {
  purposes: Purpose[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListSecurityEventsResponse {
  events: SecurityEvent[];
  total: number;
  page: number;
  pageSize: number;
}
