/**
 * Verification Schemas
 * 
 * Zod validation schemas for verification operations.
 */

import * as z from "zod/v4";
import { VerificationCertificateSchema } from "./certificate";

// ============================================================================
// Strategy & Context Schemas
// ============================================================================

export const CodePatchSchema = z.object({
  id: z.string(),
  path: z.string(),
  description: z.string(),
  diff: z.string(),
  originalContent: z.string().optional(),
  modifiedContent: z.string().optional(),
  state: z.enum(["original", "modified"]),
});

export const VerificationContextSchema = z.object({
  patches: z.array(CodePatchSchema).optional(),
  testFiles: z.array(z.string()).optional(),
  description: z.string().optional(),
  repository: z.object({
    path: z.string(),
    branch: z.string().optional(),
    commit: z.string().optional(),
    remote: z.string().optional(),
  }).optional(),
  expectedBehavior: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  history: z.object({
    previousVerifications: z.array(z.string()).optional(),
    relatedIssues: z.array(z.string()).optional(),
  }).optional(),
});

export const VerificationStrategySchema = z.object({
  mode: z.enum(["empirical", "semi-formal", "both", "adaptive"]),
  confidenceThreshold: z.number().min(0).max(1).default(0.8),
  fallbackOnUncertainty: z.boolean().default(true),
  model: z.object({
    providerId: z.string(),
    modelId: z.string(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
  }),
  timeouts: z.object({
    semiFormalMs: z.number().int().positive().default(60000),
    empiricalMs: z.number().int().positive().default(300000),
    totalMs: z.number().int().positive().default(600000),
  }),
  context: VerificationContextSchema,
  features: z.object({
    enableCaching: z.boolean().default(true),
    enableParallel: z.boolean().default(true),
    enableTracing: z.boolean().default(true),
    enableMetrics: z.boolean().default(true),
  }),
});

// ============================================================================
// Result Schemas
// ============================================================================

export const TestResultSchema = z.object({
  name: z.string(),
  file: z.string(),
  passed: z.boolean(),
  durationMs: z.number().nonnegative(),
  error: z.object({
    message: z.string(),
    stackTrace: z.string().optional(),
    expected: z.string().optional(),
    actual: z.string().optional(),
  }).optional(),
  isNew: z.boolean().optional(),
  isFlaky: z.boolean().optional(),
});

export const CodeCoverageSchema = z.object({
  percentage: z.number().min(0).max(100),
  files: z.array(z.object({
    path: z.string(),
    percentage: z.number().min(0).max(100),
    lines: z.object({
      total: z.number().int().nonnegative(),
      covered: z.number().int().nonnegative(),
    }),
    branches: z.object({
      total: z.number().int().nonnegative(),
      covered: z.number().int().nonnegative(),
    }).optional(),
    functions: z.object({
      total: z.number().int().nonnegative(),
      covered: z.number().int().nonnegative(),
    }).optional(),
  })),
  uncoveredLines: z.record(z.string(), z.array(z.number().int())).optional(),
});

export const EmpiricalVerificationResultSchema = z.object({
  passed: z.boolean(),
  reason: z.string(),
  nextAction: z.enum(["stop", "continue", "replan", "ask_user"]),
  testResults: z.array(TestResultSchema),
  execution: z.object({
    durationMs: z.number().nonnegative(),
    testsRun: z.number().int().nonnegative(),
    testsPassed: z.number().int().nonnegative(),
    testsFailed: z.number().int().nonnegative(),
    coverage: CodeCoverageSchema.optional(),
  }),
  rawOutput: z.string().optional(),
  exitCode: z.number().int(),
});

export const SemiFormalVerificationResultSchema = z.object({
  passed: z.boolean(),
  reason: z.string(),
  nextAction: z.enum(["stop", "continue", "replan", "ask_user"]),
  certificate: VerificationCertificateSchema,
  confidence: z.object({
    level: z.enum(["high", "medium", "low"]),
    score: z.number().min(0).max(1),
    reasoning: z.string(),
  }),
  certificateValidation: z.object({
    valid: z.boolean(),
    completeness: z.number().min(0).max(1),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
  timing: z.object({
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    durationMs: z.number().nonnegative(),
  }),
  reasoning: z.object({
    premisesCount: z.number().int().nonnegative(),
    tracesCount: z.number().int().nonnegative(),
    edgeCasesCount: z.number().int().nonnegative(),
    alternativeHypothesesCount: z.number().int().nonnegative(),
    avgEvidenceQuality: z.number().min(0).max(1),
  }),
});

export const OrchestratedVerificationResultSchema = z.object({
  passed: z.boolean(),
  reason: z.string(),
  nextAction: z.enum(["stop", "continue", "replan", "ask_user"]),
  methodsUsed: z.array(z.enum(["empirical", "semi-formal", "both", "adaptive"])),
  consensus: z.boolean(),
  results: z.object({
    empirical: EmpiricalVerificationResultSchema.optional(),
    semiFormal: SemiFormalVerificationResultSchema.optional(),
  }),
  confidence: z.enum(["high", "medium", "low"]),
  certificate: VerificationCertificateSchema.optional(),
  formattedCertificate: z.string().optional(),
  disagreement: z.object({
    empiricalPassed: z.boolean(),
    semiFormalPassed: z.boolean(),
    analysis: z.string(),
  }).optional(),
  resolutionStrategy: z.enum(["trust_empirical", "trust_semi_formal", "human_review", "reverify"]).optional(),
  timing: z.object({
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    durationMs: z.number().nonnegative(),
    methodDurations: z.object({
      empirical: z.number().nonnegative().optional(),
      semiFormal: z.number().nonnegative().optional(),
    }),
  }),
  storage: z.object({
    id: z.string(),
    url: z.string().optional(),
  }).optional(),
});

// ============================================================================
// Request Schemas
// ============================================================================

export const PatchEquivalenceRequestSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  patch1: CodePatchSchema,
  patch2: CodePatchSchema,
  testContext: z.object({
    testPatch: z.string().optional(),
    repositoryContext: z.string(),
    relevantTests: z.array(z.string()).min(1),
    testDescriptions: z.record(z.string(), z.string()).optional(),
  }),
  options: z.object({
    requireCounterexample: z.boolean().default(true),
    traceDepth: z.number().int().positive().default(10),
    model: z.object({
      providerId: z.string(),
      modelId: z.string(),
    }).optional(),
  }),
});

export const FaultLocalizationRequestSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  failingTest: z.string(),
  testCode: z.string(),
  sourceFiles: z.array(z.string()).min(1, "At least one source file is required"),
  repository: z.object({
    path: z.string(),
    language: z.string(),
  }),
  errorInfo: z.object({
    type: z.string(),
    message: z.string(),
    stackTrace: z.string().optional(),
  }).optional(),
});

// ============================================================================
// Progress & Status Schemas
// ============================================================================

export const VerificationProgressSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "running", "paused", "completed", "failed", "cancelled", "timeout"]),
  percentComplete: z.number().min(0).max(100),
  currentPhase: z.string(),
  completedPhases: z.array(z.string()),
  remainingPhases: z.array(z.string()),
  estimatedTimeRemainingMs: z.number().nonnegative().optional(),
  currentOperation: z.object({
    name: z.string(),
    description: z.string(),
    startedAt: z.string().datetime(),
  }).optional(),
  intermediateResults: z.record(z.string(), z.any()).optional(),
  errors: z.array(z.object({
    phase: z.string(),
    message: z.string(),
    timestamp: z.string().datetime(),
  })),
  lastUpdated: z.string().datetime(),
});

// ============================================================================
// Storage Schemas
// ============================================================================

export const StoredVerificationSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  timestamp: z.string().datetime(),
  type: z.enum(["patch_equivalence", "fault_localization", "code_qa", "general", "batch"]),
  certificate: VerificationCertificateSchema.optional(),
  result: z.object({
    passed: z.boolean(),
    confidence: z.enum(["high", "medium", "low"]),
    methodsUsed: z.array(z.enum(["empirical", "semi-formal", "both", "adaptive"])),
    consensus: z.boolean(),
  }),
  fullResult: OrchestratedVerificationResultSchema,
  artifacts: z.object({
    patches: z.array(z.object({
      path: z.string(),
      hash: z.string(),
    })).optional(),
    testFiles: z.array(z.string()).optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
  confirmed: z.object({
    correct: z.boolean(),
    confirmedAt: z.string().datetime(),
    confirmedBy: z.string(),
    notes: z.string().optional(),
  }).optional(),
  searchIndex: z.object({
    project: z.string().optional(),
    branch: z.string().optional(),
    files: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
  }).optional(),
});

export const VerificationQuerySchema = z.object({
  sessionId: z.string().optional(),
  type: z.enum(["patch_equivalence", "fault_localization", "code_qa", "general", "batch"]).optional(),
  passed: z.boolean().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  tags: z.array(z.string()).optional(),
  confirmed: z.boolean().optional(),
  since: z.date().optional(),
  until: z.date().optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
  sortBy: z.enum(["timestamp", "confidence", "passed"]).default("timestamp"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const VerificationStatisticsSchema = z.object({
  counts: z.object({
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
  byConfidence: z.object({
    high: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    low: z.number().int().nonnegative(),
  }),
  byMethod: z.record(z.string(), z.number().int()),
  byType: z.record(z.string(), z.number().int()),
  confirmation: z.object({
    confirmedCorrect: z.number().int().nonnegative(),
    confirmedIncorrect: z.number().int().nonnegative(),
    unconfirmed: z.number().int().nonnegative(),
    accuracy: z.number().min(0).max(1).optional(),
  }),
  performance: z.object({
    averageDurationMs: z.number().nonnegative(),
    minDurationMs: z.number().nonnegative(),
    maxDurationMs: z.number().nonnegative(),
    p95DurationMs: z.number().nonnegative(),
  }),
  trends: z.array(z.object({
    date: z.string(),
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    accuracy: z.number().min(0).max(1),
  })).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type VerificationStrategyOutput = z.output<typeof VerificationStrategySchema>;
export type OrchestratedVerificationResultOutput = z.output<typeof OrchestratedVerificationResultSchema>;
export type StoredVerificationOutput = z.output<typeof StoredVerificationSchema>;
export type VerificationQueryOutput = z.output<typeof VerificationQuerySchema>;
export type VerificationStatisticsOutput = z.output<typeof VerificationStatisticsSchema>;
export type PatchEquivalenceRequestOutput = z.output<typeof PatchEquivalenceRequestSchema>;
export type FaultLocalizationRequestOutput = z.output<typeof FaultLocalizationRequestSchema>;
