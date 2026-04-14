/**
 * WIH Types
 * 
 * Based on agent/Agentic Prompts/formats/wih-scheme.md
 */

export type ExecutionPermissionMode = 'read_only' | 'write_leased' | 'yolo';

export interface WIH {
  wih_version: number;
  work_item_id: string;
  title: string;
  owner_role: string;
  assigned_roles: RoleAssignments;
  inputs: WIHInputs;
  scope: WIHScope;
  outputs: WIHOutputs;
  acceptance: AcceptanceCriteria;
  blockers: Blockers;
  stop_conditions: StopConditions;
  
  // Body content (markdown after YAML front matter)
  body?: string;
  
  // Source file path
  source_path?: string;
}

export interface RoleAssignments {
  builder?: string;
  validator?: string;
  reviewer?: string;
  security?: string;
  orchestrator?: string;
}

export interface WIHInputs {
  sot?: string;  // Source of truth doc
  requirements?: string[];
  contracts?: string[];
  context_packs?: string[];
  artifacts_from_deps?: string[];  // receipt:R-abc123 format
}

export interface WIHScope {
  allowed_paths: string[];
  forbidden_paths: string[];
  allowed_tools: string[];
  forbidden_tools?: string[];
  execution_permission: {
    mode: ExecutionPermissionMode;
    flags?: string[];
  };
}

export interface WIHOutputs {
  required_artifacts: string[];
  required_reports: string[];
  artifact_root_policy: ArtifactRootPolicy;
}

export interface ArtifactRootPolicy {
  durable_outputs_via: 'rails' | 'none';
  local_workspace_root: string;
  forbid_repo_writes_by_default: boolean;
}

export interface AcceptanceCriteria {
  tests?: string[];
  invariants?: string[];
  evidence?: string[];
}

export interface Blockers {
  fail_on?: string[];
}

export interface StopConditions {
  escalate_if?: string[];
  max_iterations?: number;
}

// Validator report schema
export interface ValidatorReport {
  result: 'PASS' | 'FAIL';
  violations: Violation[];
  required_fixes: string[];
  evidence: string[];
  summary?: string;
}

export interface Violation {
  type: string;
  message: string;
  file?: string;
  line?: number;
}

// Builder report schema
export interface BuilderReport {
  status: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  summary: string;
  artifacts_created: ArtifactInfo[];
  artifacts_modified: ArtifactInfo[];
  tests_added?: number;
  tests_passed?: number;
  tests_failed?: number;
  coverage_metrics?: CoverageMetrics;
  notes?: string[];
}

export interface ArtifactInfo {
  path: string;
  kind: 'code' | 'test' | 'doc' | 'config' | 'other';
  hash?: string;
  size_bytes?: number;
}

export interface CoverageMetrics {
  lines_percentage?: number;
  functions_percentage?: number;
  branches_percentage?: number;
}

// Security report schema
export interface SecurityReport {
  result: 'PASS' | 'FAIL' | 'WARNING';
  threat_level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  findings: SecurityFinding[];
  recommendations: string[];
  compliance_status: Record<string, 'PASS' | 'FAIL' | 'NA'>;
}

export interface SecurityFinding {
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  title: string;
  description: string;
  file?: string;
  line?: number;
  recommendation?: string;
}
