/**
 * Verification Result Types
 * 
 * Types for verification operations and results.
 */

import type { VerificationCertificate } from "./certificate";
import type { Plan } from "@/runtime/loop/planner";
import type { ExecutionReceipt } from "@/runtime/loop/executor";

// ============================================================================
// Verification Modes & Strategies
// ============================================================================

/**
 * Verification mode determines which method(s) to use
 */
export type VerificationMode = 
  | "empirical"      // Traditional test-based verification
  | "semi-formal"    // Reasoning-based verification (Meta's approach)
  | "both"           // Run both and compare
  | "adaptive";      // Smart selection based on confidence

/**
 * Confidence levels for verification results
 */
export type VerificationConfidence = "high" | "medium" | "low";

/**
 * Strategy configuration for verification
 */
export interface VerificationStrategy {
  /** Which verification mode to use */
  mode: VerificationMode;
  
  /** Threshold for high confidence (0-1) */
  confidenceThreshold: number;
  
  /** Whether to fall back to empirical if semi-formal is uncertain */
  fallbackOnUncertainty: boolean;
  
  /** Model configuration for semi-formal verification */
  model: {
    providerId: string;
    modelId: string;
    temperature?: number;
    maxTokens?: number;
  };
  
  /** Timeout configuration */
  timeouts: {
    semiFormalMs: number;
    empiricalMs: number;
    totalMs: number;
  };
  
  /** Additional context for verification */
  context: VerificationContext;
  
  /** Feature flags */
  features: {
    enableCaching: boolean;
    enableParallel: boolean;
    enableTracing: boolean;
    enableMetrics: boolean;
  };
}

/**
 * Context for verification
 */
export interface VerificationContext {
  /** Code patches being verified */
  patches?: CodePatch[];
  
  /** Test files relevant to verification */
  testFiles?: string[];
  
  /** Human-readable description of what's being verified */
  description?: string;
  
  /** Repository information */
  repository?: {
    path: string;
    branch?: string;
    commit?: string;
    remote?: string;
  };
  
  /** Expected behavior */
  expectedBehavior?: string;
  
  /** Acceptance criteria */
  acceptanceCriteria?: string[];
  
  /** Historical context */
  history?: {
    previousVerifications?: string[];
    relatedIssues?: string[];
  };
}

/**
 * A code patch for verification
 */
export interface CodePatch {
  /** Unique identifier */
  id: string;
  
  /** File path */
  path: string;
  
  /** Description of changes */
  description: string;
  
  /** Diff content */
  diff: string;
  
  /** Original content (if available) */
  originalContent?: string;
  
  /** Modified content (if available) */
  modifiedContent?: string;
  
  /** Whether this is the "before" or "after" state */
  state: "original" | "modified";
}

// ============================================================================
// Verification Results
// ============================================================================

/**
 * Result from empirical verification
 */
export interface EmpiricalVerificationResult {
  /** Whether verification passed */
  passed: boolean;
  
  /** Human-readable reason */
  reason: string;
  
  /** Next action recommendation */
  nextAction: "stop" | "continue" | "replan" | "ask_user";
  
  /** Test results */
  testResults: TestResult[];
  
  /** Execution summary */
  execution: {
    durationMs: number;
    testsRun: number;
    testsPassed: number;
    testsFailed: number;
    coverage?: CodeCoverage;
  };
  
  /** Raw output from test runner */
  rawOutput?: string;
  
  /** Exit code from test process */
  exitCode: number;
}

/**
 * Individual test result
 */
export interface TestResult {
  /** Test name */
  name: string;
  
  /** Test file */
  file: string;
  
  /** Whether test passed */
  passed: boolean;
  
  /** Duration in milliseconds */
  durationMs: number;
  
  /** Error if test failed */
  error?: {
    message: string;
    stackTrace?: string;
    expected?: string;
    actual?: string;
  };
  
  /** Whether this is a new test */
  isNew?: boolean;
  
  /** Whether this test was flaky */
  isFlaky?: boolean;
}

/**
 * Code coverage information
 */
export interface CodeCoverage {
  /** Overall percentage */
  percentage: number;
  
  /** Files covered */
  files: Array<{
    path: string;
    percentage: number;
    lines: {
      total: number;
      covered: number;
    };
    branches?: {
      total: number;
      covered: number;
    };
    functions?: {
      total: number;
      covered: number;
    };
  }>;
  
  /** Uncovered lines by file */
  uncoveredLines?: Record<string, number[]>;
}

/**
 * Result from semi-formal verification
 */
export interface SemiFormalVerificationResult {
  /** Whether verification passed */
  passed: boolean;
  
  /** Human-readable reason */
  reason: string;
  
  /** Next action recommendation */
  nextAction: "stop" | "continue" | "replan" | "ask_user";
  
  /** The generated certificate */
  certificate: VerificationCertificate;
  
  /** Confidence metrics */
  confidence: {
    level: VerificationConfidence;
    score: number;  // 0-1
    reasoning: string;
  };
  
  /** Validation of certificate */
  certificateValidation: {
    valid: boolean;
    completeness: number;
    errors: string[];
    warnings: string[];
  };
  
  /** Timing */
  timing: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
  };
  
  /** Metadata about reasoning */
  reasoning: {
    premisesCount: number;
    tracesCount: number;
    edgeCasesCount: number;
    alternativeHypothesesCount: number;
    avgEvidenceQuality: number;
  };
}

/**
 * Combined/orchestrated verification result
 */
export interface OrchestratedVerificationResult {
  /** Whether verification passed (aggregated) */
  passed: boolean;
  
  /** Human-readable reason */
  reason: string;
  
  /** Next action recommendation */
  nextAction: "stop" | "continue" | "replan" | "ask_user";
  
  /** Which verification method(s) were used */
  methodsUsed: VerificationMode[];
  
  /** Whether methods agreed */
  consensus: boolean;
  
  /** Detailed results from each method */
  results: {
    empirical?: EmpiricalVerificationResult;
    semiFormal?: SemiFormalVerificationResult;
  };
  
  /** Aggregated confidence */
  confidence: VerificationConfidence;
  
  /** The certificate (if semi-formal was used) */
  certificate?: VerificationCertificate;
  
  /** Formatted certificate for display */
  formattedCertificate?: string;
  
  /** If methods disagreed, details */
  disagreement?: {
    empiricalPassed: boolean;
    semiFormalPassed: boolean;
    analysis: string;
  };
  
  /** Recommended action if consensus is false */
  resolutionStrategy?: "trust_empirical" | "trust_semi_formal" | "human_review" | "reverify";
  
  /** Timing */
  timing: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
    methodDurations: {
      empirical?: number;
      semiFormal?: number;
    };
  };
  
  /** Storage reference */
  storage?: {
    id: string;
    url?: string;
  };
}

// ============================================================================
// Verification Request/Input Types
// ============================================================================

/**
 * Request to verify a plan's execution
 */
export interface VerificationRequest {
  /** Unique request ID */
  id: string;
  
  /** Session ID */
  sessionId: string;
  
  /** When request was created */
  timestamp: string;
  
  /** The plan that was executed */
  plan: Plan;
  
  /** Execution receipts */
  receipts: ExecutionReceipt[];
  
  /** Verification strategy */
  strategy: VerificationStrategy;
  
  /** Callback URL for async results */
  callbackUrl?: string;
}

/**
 * Request for patch equivalence verification
 */
export interface PatchEquivalenceRequest {
  /** Request ID */
  id: string;
  
  /** Session ID */
  sessionId: string;
  
  /** First patch */
  patch1: CodePatch;
  
  /** Second patch */
  patch2: CodePatch;
  
  /** Test context */
  testContext: {
    /** Test patch/diff if available */
    testPatch?: string;
    
    /** Repository context */
    repositoryContext: string;
    
    /** Relevant test names */
    relevantTests: string[];
    
    /** Test descriptions */
    testDescriptions?: Record<string, string>;
  };
  
  /** Verification options */
  options: {
    requireCounterexample: boolean;
    traceDepth: number;
    model?: {
      providerId: string;
      modelId: string;
    };
  };
}

/**
 * Request for fault localization
 */
export interface FaultLocalizationRequest {
  /** Request ID */
  id: string;
  
  /** Session ID */
  sessionId: string;
  
  /** Failing test name */
  failingTest: string;
  
  /** Test code */
  testCode: string;
  
  /** Source files in scope */
  sourceFiles: string[];
  
  /** Repository context */
  repository: {
    path: string;
    language: string;
  };
  
  /** Error information (if available) */
  errorInfo?: {
    type: string;
    message: string;
    stackTrace?: string;
  };
}

/**
 * Result from fault localization
 */
export interface FaultLocalizationResult {
  /** Whether localization succeeded */
  success: boolean;
  
  /** Ranked list of suspicious locations */
  suspiciousLocations: Array<{
    rank: number;
    file: string;
    line: number;
    function?: string;
    score: number;
    reason: string;
  }>;
  
  /** Certificate documenting the analysis */
  certificate: VerificationCertificate;
  
  /** Ground truth if known */
  groundTruth?: {
    file: string;
    line: number;
    foundInTopN: number;
  };
}

// ============================================================================
// Verification Status & Progress
// ============================================================================

/**
 * Status of a verification operation
 */
export type VerificationStatus = 
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout";

/**
 * Progress information for long-running verifications
 */
export interface VerificationProgress {
  /** Verification ID */
  id: string;
  
  /** Current status */
  status: VerificationStatus;
  
  /** Progress percentage (0-100) */
  percentComplete: number;
  
  /** Current phase */
  currentPhase: string;
  
  /** Phases completed */
  completedPhases: string[];
  
  /** Phases remaining */
  remainingPhases: string[];
  
  /** Estimated time remaining (ms) */
  estimatedTimeRemainingMs?: number;
  
  /** Current operation details */
  currentOperation?: {
    name: string;
    description: string;
    startedAt: string;
  };
  
  /** Any intermediate results */
  intermediateResults?: Record<string, unknown>;
  
  /** Errors encountered (non-fatal) */
  errors: Array<{
    phase: string;
    message: string;
    timestamp: string;
  }>;
  
  /** Last updated */
  lastUpdated: string;
}

// ============================================================================
// Batch & Parallel Verification
// ============================================================================

/**
 * Batch verification request
 */
export interface BatchVerificationRequest {
  /** Batch ID */
  id: string;
  
  /** Individual verification requests */
  requests: VerificationRequest[];
  
  /** Strategy for batch execution */
  batchStrategy: {
    maxConcurrency: number;
    continueOnError: boolean;
    aggregateResults: boolean;
  };
}

/**
 * Batch verification result
 */
export interface BatchVerificationResult {
  /** Batch ID */
  id: string;
  
  /** Individual results */
  results: OrchestratedVerificationResult[];
  
  /** Aggregate statistics */
  statistics: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
    averageDurationMs: number;
    totalDurationMs: number;
  };
  
  /** Common patterns found */
  patterns?: {
    commonFailures?: string[];
    commonWarnings?: string[];
    recommendations?: string[];
  };
}

// ============================================================================
// Storage & Persistence Types
// ============================================================================

/**
 * Stored verification record
 */
export interface StoredVerification {
  /** Unique identifier */
  id: string;
  
  /** Session that performed the verification */
  sessionId: string;
  
  /** When the verification was performed */
  timestamp: string;
  
  /** Type of verification */
  type: "patch_equivalence" | "fault_localization" | "code_qa" | "general" | "batch";
  
  /** The certificate (if semi-formal was used) */
  certificate?: VerificationCertificate;
  
  /** Result summary */
  result: {
    passed: boolean;
    confidence: VerificationConfidence;
    methodsUsed: VerificationMode[];
    consensus: boolean;
  };
  
  /** Full result data */
  fullResult: OrchestratedVerificationResult;
  
  /** Associated artifacts */
  artifacts?: {
    patches?: Array<{ path: string; hash: string }>;
    testFiles?: string[];
    receipts?: ExecutionReceipt[];
  };
  
  /** Tags for categorization */
  tags?: string[];
  
  /** Whether this verification was later confirmed correct */
  confirmed?: {
    correct: boolean;
    confirmedAt: string;
    confirmedBy: string;
    notes?: string;
  };
  
  /** Search index fields */
  searchIndex?: {
    project?: string;
    branch?: string;
    files?: string[];
    keywords?: string[];
  };
}

/**
 * Query for searching stored verifications
 */
export interface VerificationQuery {
  /** Filter by session */
  sessionId?: string;
  
  /** Filter by type */
  type?: StoredVerification["type"];
  
  /** Filter by result */
  passed?: boolean;
  
  /** Filter by confidence */
  confidence?: VerificationConfidence;
  
  /** Filter by tags */
  tags?: string[];
  
  /** Filter by confirmation status */
  confirmed?: boolean;
  
  /** Date range */
  since?: Date;
  until?: Date;
  
  /** Text search */
  search?: string;
  
  /** Pagination */
  limit?: number;
  offset?: number;
  
  /** Sort order */
  sortBy?: "timestamp" | "confidence" | "passed";
  sortOrder?: "asc" | "desc";
}

/**
 * Statistics for verifications
 */
export interface VerificationStatistics {
  /** Overall counts */
  counts: {
    total: number;
    passed: number;
    failed: number;
  };
  
  /** By confidence level */
  byConfidence: {
    high: number;
    medium: number;
    low: number;
  };
  
  /** By verification method */
  byMethod: Record<string, number>;
  
  /** By type */
  byType: Record<string, number>;
  
  /** Confirmation tracking */
  confirmation: {
    confirmedCorrect: number;
    confirmedIncorrect: number;
    unconfirmed: number;
    accuracy?: number;
  };
  
  /** Performance metrics */
  performance: {
    averageDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    p95DurationMs: number;
  };
  
  /** Trends (if time range specified) */
  trends?: Array<{
    date: string;
    total: number;
    passed: number;
    accuracy: number;
  }>;
}
