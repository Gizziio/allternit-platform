/**
 * Certificate Schemas
 * 
 * Zod validation schemas for certificate types.
 */

import z from "zod/v4";

// ============================================================================
// Primitive Schemas
// ============================================================================

export const SourceLocationSchema = z.object({
  file: z.string().min(1, "File path is required"),
  line: z.number().int().positive("Line number must be positive"),
  column: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  context: z.string().optional(),
  snippet: z.string().optional(),
});

export const EvidenceSchema = z.object({
  description: z.string().min(1, "Evidence description is required"),
  sourceLocations: z.array(SourceLocationSchema).min(1, "At least one source location is required"),
  verificationMethod: z.enum([
    "file_read",
    "code_search",
    "ast_analysis",
    "test_execution",
    "documentation",
    "external_reference",
    "assumption",
  ]),
  content: z.string().optional(),
  contentHash: z.string().optional(),
  timestamp: z.string().datetime(),
});

// ============================================================================
// Proof Structure Schemas
// ============================================================================

export const DefinitionSchema = z.object({
  id: z.string().regex(/^[DPET]\d+$/, "Definition ID must be in format D1, P1, etc."),
  statement: z.string().min(1, "Definition statement is required"),
  context: z.string().optional(),
});

export const PremiseSchema = z.object({
  id: z.string().regex(/^[DPET]\d+$/, "Premise ID must be in format P1, P2, etc."),
  statement: z.string().min(1, "Premise statement is required"),
  evidence: EvidenceSchema,
  dependsOn: z.array(z.string()).optional(),
  certainty: z.enum(["proven", "inferred", "assumed"]),
});

// ============================================================================
// Execution Trace Schemas
// ============================================================================

export const VariableStateSchema = z.object({
  name: z.string(),
  type: z.string().optional(),
  value: z.string(),
  isParameter: z.boolean().optional(),
  isReturn: z.boolean().optional(),
});

export const FunctionCallSchema = z.object({
  function: z.string(),
  arguments: z.array(z.string()).optional(),
  returnValue: z.string().optional(),
  callSite: SourceLocationSchema,
  traced: z.boolean(),
  notTracedReason: z.enum(["third_party", "builtin", "unavailable", "time_limit"]).optional(),
});

export const ExecutionStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  location: SourceLocationSchema,
  function: z.object({
    name: z.string(),
    signature: z.string().optional(),
    package: z.string().optional(),
  }).optional(),
  behavior: z.string().min(1, "Step behavior description is required"),
  variables: z.array(VariableStateSchema).optional(),
  calls: z.array(FunctionCallSchema).optional(),
  controlFlow: z.object({
    type: z.enum(["conditional", "loop", "return", "throw", "call"]),
    condition: z.string().optional(),
    branch: z.enum(["true", "false", "iteration", "exit"]).optional(),
  }).optional(),
  dependsOn: z.array(z.number().int().positive()).optional(),
});

export const TraceOutcomeSchema = z.object({
  status: z.enum(["pass", "fail", "error", "unknown", "timeout"]),
  description: z.string(),
  error: z.object({
    type: z.string(),
    message: z.string(),
    stackTrace: z.string().optional(),
    location: SourceLocationSchema.optional(),
  }).optional(),
  exitCode: z.number().int().optional(),
});

export const ExecutionTraceSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Trace name is required"),
  testName: z.string().optional(),
  scenario: z.string().min(1, "Scenario description is required"),
  input: z.any().optional(),
  expectedOutput: z.string().optional(),
  actualOutput: z.string().optional(),
  steps: z.array(ExecutionStepSchema).min(1, "At least one execution step is required"),
  outcome: TraceOutcomeSchema,
  reasoning: z.string().min(1, "Trace reasoning is required"),
  patchId: z.string().optional(),
});

// ============================================================================
// Edge Case & Analysis Schemas
// ============================================================================

export const EdgeCaseBehaviorSchema = z.object({
  expected: z.string(),
  actual: z.string(),
  testOutcome: z.enum(["pass", "fail", "not_tested"]),
  location: SourceLocationSchema.optional(),
});

export const EdgeCaseAnalysisSchema = z.object({
  description: z.string().min(1, "Edge case description is required"),
  category: z.enum([
    "null_input",
    "empty_collection",
    "boundary_value",
    "concurrent_access",
    "resource_exhaustion",
    "type_mismatch",
    "encoding",
    "timing",
    "custom",
  ]),
  input: z.any().optional(),
  patch1Behavior: EdgeCaseBehaviorSchema.optional(),
  patch2Behavior: EdgeCaseBehaviorSchema.optional(),
  behavior: EdgeCaseBehaviorSchema.optional(),
  outcomesMatch: z.boolean().optional(),
  reasoning: z.string().min(1, "Edge case reasoning is required"),
});

export const AlternativeHypothesisSchema = z.object({
  hypothesis: z.string().min(1, "Hypothesis description is required"),
  reasonConsidered: z.string(),
  counterEvidence: EvidenceSchema,
  rejectionReason: z.string(),
});

// ============================================================================
// Conclusion Schemas
// ============================================================================

export const ConclusionSchema = z.object({
  statement: z.string().min(1, "Conclusion statement is required"),
  summary: z.string().min(1, "Conclusion summary is required"),
  answer: z.enum(["YES", "NO", "UNCERTAIN", "PARTIAL"]),
  followsFrom: z.array(z.string()).min(1, "Must cite at least one premise or trace"),
  followsFromTraces: z.array(z.string()).optional(),
  confidence: z.object({
    level: z.enum(["high", "medium", "low"]),
    reasoning: z.string(),
    factors: z.array(z.object({
      factor: z.string(),
      impact: z.enum(["increases", "decreases", "neutral"]),
      description: z.string(),
    })).optional(),
  }),
  confidenceGap: z.string().optional(),
  limitations: z.array(z.string()).optional(),
});

export const CounterexampleSchema = z.object({
  testName: z.string().optional(),
  location: SourceLocationSchema,
  input: z.any().optional(),
  expected: z.string(),
  actual: z.string(),
  failureTrace: z.array(ExecutionStepSchema).min(1, "Failure trace is required for counterexample"),
  rootCause: z.object({
    description: z.string(),
    location: SourceLocationSchema,
    explanation: z.string(),
  }),
  manifestation: z.object({
    type: z.enum(["crash", "wrong_output", "infinite_loop", "performance", "other"]),
    details: z.string(),
  }),
});

// ============================================================================
// Metadata Schemas
// ============================================================================

export const CertificateMetadataSchema = z.object({
  model: z.object({
    provider: z.string(),
    modelId: z.string(),
    version: z.string().optional(),
  }),
  parameters: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
    topP: z.number().min(0).max(1).optional(),
  }),
  timing: z.object({
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    durationMs: z.number().int().nonnegative(),
  }),
  resources: z.object({
    promptTokens: z.number().int().nonnegative().optional(),
    completionTokens: z.number().int().nonnegative().optional(),
    totalTokens: z.number().int().nonnegative().optional(),
    filesRead: z.number().int().nonnegative().optional(),
    functionsTraced: z.number().int().nonnegative().optional(),
  }).optional(),
  toolVersions: z.object({
    verifier: z.string(),
    schema: z.string(),
  }).optional(),
  session: z.object({
    id: z.string(),
    project: z.string().optional(),
    branch: z.string().optional(),
  }).optional(),
});

// ============================================================================
// Main Certificate Schema
// ============================================================================

export const PatchReferenceSchema = z.object({
  id: z.string(),
  path: z.string(),
  description: z.string(),
  diff: z.string().optional(),
  commitSha: z.string().optional(),
  author: z.object({
    name: z.string(),
    email: z.string().optional(),
  }).optional(),
  timestamp: z.string().datetime().optional(),
});

export const VerificationTaskSchema = z.object({
  type: z.enum(["patch_equivalence", "fault_localization", "code_qa", "general"]),
  description: z.string().min(1, "Task description is required"),
  question: z.string().optional(),
  scope: z.object({
    files: z.array(z.string()).optional(),
    tests: z.array(z.string()).optional(),
    commits: z.array(z.string()).optional(),
    patches: z.array(PatchReferenceSchema).optional(),
  }),
});

export const VerificationCertificateSchema = z.object({
  version: z.literal("1.0"),
  id: z.string().min(1, "Certificate ID is required"),
  timestamp: z.string().datetime(),
  task: VerificationTaskSchema,
  definitions: z.array(DefinitionSchema),
  premises: z.array(PremiseSchema).min(1, "At least one premise is required"),
  executionTraces: z.array(ExecutionTraceSchema).min(1, "At least one execution trace is required"),
  edgeCases: z.array(EdgeCaseAnalysisSchema),
  conclusion: ConclusionSchema,
  counterexample: CounterexampleSchema.optional(),
  alternativeHypotheses: z.array(AlternativeHypothesisSchema).optional(),
  metadata: CertificateMetadataSchema,
});

// ============================================================================
// Validation Result Schemas
// ============================================================================

export const CertificateValidationErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  path: z.string(),
  severity: z.enum(["error", "critical"]),
  suggestion: z.string().optional(),
});

export const CertificateValidationWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  path: z.string(),
  suggestion: z.string().optional(),
});

export const CertificateValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(CertificateValidationErrorSchema),
  warnings: z.array(CertificateValidationWarningSchema),
  completeness: z.number().min(0).max(1),
  metrics: z.object({
    premiseCount: z.number().int().nonnegative(),
    traceCount: z.number().int().nonnegative(),
    avgEvidenceQuality: z.number().min(0).max(1),
    citationCoverage: z.number().min(0).max(1),
  }),
});

// ============================================================================
// Export Schemas
// ============================================================================

export const CertificateExportOptionsSchema = z.object({
  format: z.enum(["json", "markdown", "pdf", "html"]),
  includeMetadata: z.boolean().default(true),
  includeRawEvidence: z.boolean().default(false),
  prettyPrint: z.boolean().default(true),
  template: z.string().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type VerificationCertificateInput = z.input<typeof VerificationCertificateSchema>;
export type VerificationCertificateOutput = z.output<typeof VerificationCertificateSchema>;
export type CertificateValidationResultOutput = z.output<typeof CertificateValidationResultSchema>;
export type CertificateExportOptionsOutput = z.output<typeof CertificateExportOptionsSchema>;
