/**
 * A2R Law Layer - Types
 * 
 * Type definitions for the governance and policy engine.
 */

import type {
  A2RKernel,
  WihItem,
  Receipt,
  RoutingDecision,
  ToolContext,
  FileContext,
} from '@a2r/governor';

// ============================================================================
// Policy Types
// ============================================================================

/**
 * Policy scope - what the policy applies to
 */
export type PolicyScope = 
  | 'global'      // Applies to all sessions
  | 'phase'       // Applies to specific phase
  | 'wih'         // Applies to specific WIH
  | 'agent'       // Applies to specific agent
  | 'session';    // Applies to specific session

/**
 * Policy rule - a single rule within a policy
 */
export interface PolicyRule {
  id: string;
  name: string;
  description?: string;
  
  /**
   * Condition for when this rule applies
   */
  condition: PolicyCondition;
  
  /**
   * Action to take when condition matches
   */
  action: PolicyAction;
  
  /**
   * Rule priority (higher = evaluated first)
   * @default 50
   */
  priority?: number;
  
  /**
   * Whether rule is active
   * @default true
   */
  enabled?: boolean;
}

/**
 * Policy condition
 */
export interface PolicyCondition {
  /**
   * Match operation type
   */
  type: 'tool' | 'file' | 'path' | 'agent' | 'wih' | 'phase' | 'custom';
  
  /**
   * Match operator
   */
  operator: 'equals' | 'contains' | 'matches' | 'startsWith' | 'endsWith' | 'in' | 'regex';
  
  /**
   * Field to match on
   */
  field: string;
  
  /**
   * Value to match against
   */
  value: unknown;
  
  /**
   * Whether to negate the condition
   */
  negate?: boolean;
}

/**
 * Policy action
 */
export interface PolicyAction {
  /**
   * Decision to make
   */
  decision: RoutingDecision;
  
  /**
   * Reason for the decision
   */
  reason?: string;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
  
  /**
   * For 'delegate' decisions - where to delegate
   */
  delegateTo?: string;
  
  /**
   * For 'modify' decisions - parameter modifications
   */
  modifications?: Record<string, unknown>;
}

/**
 * Policy definition
 */
export interface Policy {
  id: string;
  name: string;
  description?: string;
  version: string;
  scope: PolicyScope;
  scopeTarget?: string;  // phase ID, WIH ID, agent ID, or session ID
  rules: PolicyRule[];
  enabled: boolean;
  createdAt: string;
  updatedAt?: string;
}

// ============================================================================
// Law Layer Types
// ============================================================================

/**
 * Law Layer configuration
 */
export interface LawLayerConfig {
  kernel: A2RKernel;
  
  /**
   * Default policy for all evaluations
   */
  defaultPolicy?: Policy;
  
  /**
   * Enable audit logging
   * @default true
   */
  auditLogging?: boolean;
  
  /**
   * Require explicit policy match
   * @default false
   */
  requireExplicitMatch?: boolean;
  
  /**
   * Callback for policy decisions
   */
  onDecision?: (decision: PolicyDecision) => void;
}

/**
 * Policy evaluation result
 */
export interface PolicyDecision {
  policyId: string;
  ruleId?: string;
  decision: RoutingDecision;
  reason: string;
  timestamp: string;
  context: ToolContext | FileContext;
  metadata?: Record<string, unknown>;
}

/**
 * Policy evaluation request
 */
export interface PolicyEvaluationRequest {
  context: ToolContext | FileContext;
  wihItem?: WihItem;
  overridePolicies?: string[];
}

/**
 * Policy engine interface
 */
export interface PolicyEngine {
  /**
   * Register a policy
   */
  registerPolicy(policy: Policy): void;
  
  /**
   * Unregister a policy
   */
  unregisterPolicy(policyId: string): boolean;
  
  /**
   * Get a policy by ID
   */
  getPolicy(policyId: string): Policy | null;
  
  /**
   * List all policies
   */
  listPolicies(filter?: PolicyFilter): Policy[];
  
  /**
   * Evaluate policies against a context
   */
  evaluate(request: PolicyEvaluationRequest): PolicyDecision;
  
  /**
   * Enable/disable a policy
   */
  setPolicyEnabled(policyId: string, enabled: boolean): boolean;
}

/**
 * Policy filter
 */
export interface PolicyFilter {
  scope?: PolicyScope;
  enabled?: boolean;
  target?: string;
}

// ============================================================================
// Beads Integration Types
// ============================================================================

/**
 * Beads issue representation
 */
export interface BeadsIssue {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'blocked' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  blockedBy: string[];
  blocks: string[];
  labels: string[];
  assignee?: string;
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Beads adapter configuration
 */
export interface BeadsAdapterConfig {
  /**
   * Path to beads database
   * @default '.beads/issues.db'
   */
  dbPath?: string;
  
  /**
   * Use JSONL mode instead of SQLite
   * @default false
   */
  jsonlMode?: boolean;
  
  /**
   * Auto-sync with git
   * @default true
   */
  autoSync?: boolean;
  
  /**
   * Actor name for beads operations
   */
  actor?: string;
}

/**
 * Beads adapter interface
 */
export interface BeadsAdapter {
  /**
   * Get issue by ID
   */
  getIssue(id: string): Promise<BeadsIssue | null>;
  
  /**
   * Create new issue
   */
  createIssue(issue: Omit<BeadsIssue, 'id' | 'createdAt'>): Promise<BeadsIssue>;
  
  /**
   * Update issue
   */
  updateIssue(id: string, updates: Partial<BeadsIssue>): Promise<BeadsIssue>;
  
  /**
   * Close issue
   */
  closeIssue(id: string, reason?: string): Promise<BeadsIssue>;
  
  /**
   * List issues
   */
  listIssues(filter?: BeadsFilter): Promise<BeadsIssue[]>;
  
  /**
   * Check if issue is ready for work
   */
  isReadyForWork(id: string): Promise<boolean>;
  
  /**
   * Get dependencies for issue
   */
  getDependencies(id: string): Promise<BeadsIssue[]>;
  
  /**
   * Sync with git
   */
  sync(): Promise<void>;
  
  /**
   * Convert beads issue to WIH
   */
  toWih(issue: BeadsIssue): WihItem;
  
  /**
   * Convert WIH to beads issue
   */
  fromWih(wih: WihItem): BeadsIssue;
}

/**
 * Beads filter
 */
export interface BeadsFilter {
  status?: BeadsIssue['status'] | BeadsIssue['status'][];
  priority?: BeadsIssue['priority'] | BeadsIssue['priority'][];
  assignee?: string;
  labels?: string[];
  blocked?: boolean;
}

// ============================================================================
// Receipt Types
// ============================================================================

/**
 * Receipt generator configuration
 */
export interface ReceiptGeneratorConfig {
  kernel: A2RKernel;
  
  /**
   * Auto-generate receipts on WIH completion
   * @default true
   */
  autoGenerate?: boolean;
  
  /**
   * Include git commit in attestations
   * @default true
   */
  includeGitCommit?: boolean;
  
  /**
   * Include test results in attestations
   * @default true
   */
  includeTestResults?: boolean;
  
  /**
   * Custom attestation generators
   */
  attestationGenerators?: AttestationGenerator[];
}

/**
 * Attestation generator function
 */
export type AttestationGenerator = (
  wih: WihItem,
  context: ReceiptGenerationContext
) => Promise<AttestationData> | AttestationData;

/**
 * Attestation data
 */
export interface AttestationData {
  type: string;
  value: string;
  metadata?: Record<string, unknown>;
}

/**
 * Receipt generation context
 */
export interface ReceiptGenerationContext {
  wihId: string;
  sessionId: string;
  agentId: string;
  workspaceRoot: string;
  artifacts: string[];
  gitCommit?: string;
  testResults?: TestResults;
}

/**
 * Test results
 */
export interface TestResults {
  passed: number;
  failed: number;
  skipped: number;
  coverage?: number;
  duration: number;
}

/**
 * Receipt generator interface
 */
export interface ReceiptGenerator {
  /**
   * Generate receipt for WIH
   */
  generate(wih: WihItem, context: ReceiptGenerationContext): Promise<Receipt>;
  
  /**
   * Verify receipt
   */
  verify(receipt: Receipt): Promise<boolean>;
  
  /**
   * Get receipt by WIH ID
   */
  getReceiptForWih(wihId: string): Promise<Receipt | null>;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Law Layer error
 */
export class LawLayerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'LawLayerError';
  }
}

/**
 * Policy evaluation error
 */
export class PolicyEvaluationError extends LawLayerError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'POLICY_EVALUATION_ERROR', context);
    this.name = 'PolicyEvaluationError';
  }
}

/**
 * Beads adapter error
 */
export class BeadsAdapterError extends LawLayerError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'BEADS_ADAPTER_ERROR', context);
    this.name = 'BeadsAdapterError';
  }
}

/**
 * Receipt generation error
 */
export class ReceiptGenerationError extends LawLayerError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'RECEIPT_GENERATION_ERROR', context);
    this.name = 'ReceiptGenerationError';
  }
}
