/**
 * Policy types for DAK Policy Engine
 */

/**
 * Policy effect types
 */
export type PolicyEffect = 'ALLOW' | 'DENY' | 'REVIEW' | 'AUDIT';

/**
 * Policy condition operators
 */
export type ConditionOperator = 
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'nin' | 'contains' | 'startswith' | 'endswith'
  | 'matches' // regex
  | 'exists' | 'not_exists'
  | 'and' | 'or' | 'not';

/**
 * Policy condition
 */
export interface PolicyCondition {
  operator: ConditionOperator;
  path?: string; // JSON path to value in context
  value?: unknown;
  conditions?: PolicyCondition[]; // for and/or/not
}

/**
 * Policy action
 */
export interface PolicyAction {
  action_id: string;
  tool: string;
  permission: 'read' | 'write' | 'execute' | 'admin';
  paths?: string[]; // allowed paths
  constraints?: Record<string, unknown>;
}

/**
 * Policy rule
 */
export interface PolicyRule {
  rule_id: string;
  description?: string;
  priority: number; // higher = evaluated first
  effect: PolicyEffect;
  actions: string[] | '*'; // action_ids or wildcard
  resources?: string[]; // resource patterns
  condition: PolicyCondition;
  reason_template?: string; // template for decision reason
}

/**
 * Policy definition
 */
export interface Policy {
  policy_id: string;
  version: string;
  name: string;
  description?: string;
  enabled: boolean;
  scope: {
    agents?: string[]; // agent IDs this applies to
    dag_types?: string[];
    node_types?: string[];
  };
  rules: PolicyRule[];
  default_effect: PolicyEffect;
  created_at: string;
  updated_at: string;
}

/**
 * Policy bundle - collection of policies
 */
export interface PolicyBundle {
  bundle_id: string;
  version: string;
  name: string;
  description?: string;
  bundle_hash?: string;
  policies: Policy[];
  metadata?: Record<string, unknown>;
}

/**
 * Policy evaluation context
 */
export interface EvaluationContext {
  agent_id: string;
  session_id: string;
  dag_id?: string;
  node_id?: string;
  tool_name?: string;
  tool_inputs?: Record<string, unknown>;
  file_paths?: string[];
  environment?: Record<string, string>;
  history?: PolicyDecision[]; // previous decisions
}

/**
 * Policy decision result
 */
export interface PolicyDecision {
  decision_id: string;
  timestamp: string;
  bundle_id: string;
  policy_id?: string;
  rule_id?: string;
  effect: PolicyEffect;
  reason: string;
  context: EvaluationContext;
  matched_conditions: string[];
}

/**
 * Policy engine configuration
 */
export interface PolicyEngineConfig {
  default_bundle_id?: string;
  bundles_path?: string;
  cache_enabled: boolean;
  cache_ttl_seconds: number;
  audit_all_decisions: boolean;
  max_evaluation_depth: number;
}

/**
 * Policy check request
 */
export interface PolicyCheckRequest {
  action: string;
  resource?: string;
  context: EvaluationContext;
}

/**
 * Policy check result
 */
export interface PolicyCheckResult {
  allowed: boolean;
  effect: PolicyEffect;
  decision: PolicyDecision;
  obligations?: PolicyObligation[]; // required actions
  advice?: string[]; // recommendations
}

/**
 * Policy obligation - required follow-up action
 */
export interface PolicyObligation {
  obligation_id: string;
  type: 'emit_receipt' | 'require_approval' | 'log_audit' | 'notify';
  parameters: Record<string, unknown>;
  deadline?: string;
}

/**
 * Policy violation
 */
export interface PolicyViolation {
  violation_id: string;
  timestamp: string;
  decision_id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  context: EvaluationContext;
  remediation?: string;
}
