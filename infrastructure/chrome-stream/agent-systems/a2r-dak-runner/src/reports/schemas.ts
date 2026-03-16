/**
 * Report Schemas
 * 
 * Standard report formats for validator, builder, security, and review.
 * Based on agent/Agentic Prompts/formats/wih-scheme.md and prompt-format-spec-v1.md
 */

import { z } from 'zod';

// ============================================================================
// Validator Report Schema
// ============================================================================

export const ViolationSchema = z.object({
  type: z.string().describe('Type of violation'),
  message: z.string().describe('Human-readable description'),
  file: z.string().optional().describe('File where violation occurred'),
  line: z.number().optional().describe('Line number'),
  column: z.number().optional().describe('Column number'),
  severity: z.enum(['error', 'warning', 'info']).default('error'),
});

export const ValidatorReportSchema = z.object({
  result: z.enum(['PASS', 'FAIL']),
  summary: z.string().optional(),
  violations: z.array(ViolationSchema).default([]),
  required_fixes: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
  metrics: z.object({
    tests_total: z.number().optional(),
    tests_passed: z.number().optional(),
    tests_failed: z.number().optional(),
    coverage_lines: z.number().optional(),
    coverage_functions: z.number().optional(),
  }).optional(),
  metadata: z.object({
    validator_id: z.string(),
    validated_at: z.string().datetime(),
    wih_id: z.string(),
    node_id: z.string(),
    dag_id: z.string(),
  }),
});

export type ValidatorReport = z.infer<typeof ValidatorReportSchema>;
export type Violation = z.infer<typeof ViolationSchema>;

// ============================================================================
// Builder Report Schema
// ============================================================================

export const ArtifactInfoSchema = z.object({
  path: z.string(),
  kind: z.enum(['code', 'test', 'doc', 'config', 'other']),
  hash: z.string().optional(),
  size_bytes: z.number().optional(),
  lines_added: z.number().optional(),
  lines_removed: z.number().optional(),
});

export const CoverageMetricsSchema = z.object({
  lines_percentage: z.number().min(0).max(100).optional(),
  functions_percentage: z.number().min(0).max(100).optional(),
  branches_percentage: z.number().min(0).max(100).optional(),
});

export const BuilderReportSchema = z.object({
  status: z.enum(['SUCCESS', 'FAILURE', 'PARTIAL']),
  summary: z.string(),
  artifacts_created: z.array(ArtifactInfoSchema).default([]),
  artifacts_modified: z.array(ArtifactInfoSchema).default([]),
  artifacts_deleted: z.array(ArtifactInfoSchema).default([]),
  tests: z.object({
    added: z.number().default(0),
    passed: z.number().default(0),
    failed: z.number().default(0),
    skipped: z.number().default(0),
  }).optional(),
  coverage: CoverageMetricsSchema.optional(),
  notes: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  build_time_seconds: z.number().optional(),
  metadata: z.object({
    builder_id: z.string(),
    built_at: z.string().datetime(),
    wih_id: z.string(),
    node_id: z.string(),
    dag_id: z.string(),
    iteration: z.number().default(0),
  }),
});

export type BuilderReport = z.infer<typeof BuilderReportSchema>;
export type ArtifactInfo = z.infer<typeof ArtifactInfoSchema>;
export type CoverageMetrics = z.infer<typeof CoverageMetricsSchema>;

// ============================================================================
// Security Report Schema
// ============================================================================

export const SecurityFindingSchema = z.object({
  severity: z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  category: z.string(),
  title: z.string(),
  description: z.string(),
  file: z.string().optional(),
  line: z.number().optional(),
  cwe_id: z.string().optional(),
  cve_id: z.string().optional(),
  recommendation: z.string().optional(),
  references: z.array(z.string()).default([]),
});

export const SecurityReportSchema = z.object({
  result: z.enum(['PASS', 'FAIL', 'WARNING']),
  threat_level: z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  summary: z.string().optional(),
  findings: z.array(SecurityFindingSchema).default([]),
  recommendations: z.array(z.string()).default([]),
  compliance_status: z.record(z.enum(['PASS', 'FAIL', 'NA'])).default({}),
  scanned_files: z.number().optional(),
  scan_duration_seconds: z.number().optional(),
  metadata: z.object({
    scanner_id: z.string(),
    scanned_at: z.string().datetime(),
    wih_id: z.string(),
    node_id: z.string(),
    dag_id: z.string(),
    policy_version: z.string().optional(),
  }),
});

export type SecurityReport = z.infer<typeof SecurityReportSchema>;
export type SecurityFinding = z.infer<typeof SecurityFindingSchema>;

// ============================================================================
// Review Report Schema
// ============================================================================

export const ReviewCommentSchema = z.object({
  file: z.string(),
  line: z.number().optional(),
  severity: z.enum(['suggestion', 'minor', 'major', 'blocking']),
  category: z.enum(['architecture', 'performance', 'security', 'maintainability', 'style', 'other']),
  comment: z.string(),
  suggestion: z.string().optional(),
});

export const ReviewReportSchema = z.object({
  result: z.enum(['APPROVE', 'COMMENT', 'REQUEST_CHANGES']),
  summary: z.string(),
  comments: z.array(ReviewCommentSchema).default([]),
  architecture_assessment: z.object({
    concerns: z.array(z.string()).default([]),
    recommendations: z.array(z.string()).default([]),
  }).optional(),
  risk_assessment: z.object({
    level: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    concerns: z.array(z.string()).default([]),
  }).optional(),
  metadata: z.object({
    reviewer_id: z.string(),
    reviewed_at: z.string().datetime(),
    wih_id: z.string(),
    node_id: z.string(),
    dag_id: z.string(),
    files_reviewed: z.array(z.string()).default([]),
  }),
});

export type ReviewReport = z.infer<typeof ReviewReportSchema>;
export type ReviewComment = z.infer<typeof ReviewCommentSchema>;

// ============================================================================
// Report Validation Functions
// ============================================================================

export function validateValidatorReport(data: unknown): ValidatorReport {
  return ValidatorReportSchema.parse(data);
}

export function validateBuilderReport(data: unknown): BuilderReport {
  return BuilderReportSchema.parse(data);
}

export function validateSecurityReport(data: unknown): SecurityReport {
  return SecurityReportSchema.parse(data);
}

export function validateReviewReport(data: unknown): ReviewReport {
  return ReviewReportSchema.parse(data);
}

// ============================================================================
// Report Generation Helpers
// ============================================================================

export function createValidatorReport(
  result: 'PASS' | 'FAIL',
  wihId: string,
  nodeId: string,
  dagId: string,
  validatorId: string
): ValidatorReport {
  return {
    result,
    violations: [],
    required_fixes: [],
    evidence: [],
    metadata: {
      validator_id: validatorId,
      validated_at: new Date().toISOString(),
      wih_id: wihId,
      node_id: nodeId,
      dag_id: dagId,
    },
  };
}

export function createBuilderReport(
  status: 'SUCCESS' | 'FAILURE' | 'PARTIAL',
  summary: string,
  wihId: string,
  nodeId: string,
  dagId: string,
  builderId: string,
  iteration: number = 0
): BuilderReport {
  return {
    status,
    summary,
    artifacts_created: [],
    artifacts_modified: [],
    artifacts_deleted: [],
    notes: [],
    warnings: [],
    metadata: {
      builder_id: builderId,
      built_at: new Date().toISOString(),
      wih_id: wihId,
      node_id: nodeId,
      dag_id: dagId,
      iteration,
    },
  };
}

export function createSecurityReport(
  result: 'PASS' | 'FAIL' | 'WARNING',
  threatLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  wihId: string,
  nodeId: string,
  dagId: string,
  scannerId: string
): SecurityReport {
  return {
    result,
    threat_level: threatLevel,
    findings: [],
    recommendations: [],
    compliance_status: {},
    metadata: {
      scanner_id: scannerId,
      scanned_at: new Date().toISOString(),
      wih_id: wihId,
      node_id: nodeId,
      dag_id: dagId,
    },
  };
}

export function createReviewReport(
  result: 'APPROVE' | 'COMMENT' | 'REQUEST_CHANGES',
  summary: string,
  wihId: string,
  nodeId: string,
  dagId: string,
  reviewerId: string
): ReviewReport {
  return {
    result,
    summary,
    comments: [],
    metadata: {
      reviewer_id: reviewerId,
      reviewed_at: new Date().toISOString(),
      wih_id: wihId,
      node_id: nodeId,
      dag_id: dagId,
      files_reviewed: [],
    },
  };
}

// ============================================================================
// Report Serialization
// ============================================================================

export function serializeReport(report: ValidatorReport | BuilderReport | SecurityReport | ReviewReport): string {
  return JSON.stringify(report, null, 2);
}

export function deserializeReport<T extends 'validator' | 'builder' | 'security' | 'review'>(
  type: T,
  content: string
): T extends 'validator' ? ValidatorReport : T extends 'builder' ? BuilderReport : T extends 'security' ? SecurityReport : ReviewReport {
  const data = JSON.parse(content);
  
  switch (type) {
    case 'validator':
      return validateValidatorReport(data) as any;
    case 'builder':
      return validateBuilderReport(data) as any;
    case 'security':
      return validateSecurityReport(data) as any;
    case 'review':
      return validateReviewReport(data) as any;
    default:
      throw new Error(`Unknown report type: ${type}`);
  }
}
