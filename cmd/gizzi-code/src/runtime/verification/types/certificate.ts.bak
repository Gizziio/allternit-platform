/**
 * Certificate Types
 * 
 * Core type definitions for semi-formal verification certificates.
 * Based on Meta's Agentic Code Reasoning paper (arXiv:2603.01896)
 */

/** JSON value type */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

// ============================================================================
// Core Certificate Types
// ============================================================================

/**
 * A verification certificate is a structured proof that code meets
 * specifications. It requires explicit evidence for every claim.
 */
export interface VerificationCertificate {
  /** Certificate version for schema evolution */
  version: "1.0";
  
  /** Unique identifier for this certificate */
  id: string;
  
  /** When the certificate was generated */
  timestamp: string;
  
  /** Type of verification performed */
  task: VerificationTask;
  
  /** Key definitions used in the proof */
  definitions: Definition[];
  
  /** Explicit premises with evidence */
  premises: Premise[];
  
  /** Execution traces showing code behavior */
  executionTraces: ExecutionTrace[];
  
  /** Edge case analysis */
  edgeCases: EdgeCaseAnalysis[];
  
  /** Visual evidence (screenshots, coverage maps, etc.) */
  visualEvidence?: VisualEvidence[];
  
  /** Formal conclusion */
  conclusion: Conclusion;
  
  /** Counterexample if conclusion is negative */
  counterexample?: Counterexample;
  
  /** Alternative hypotheses considered and rejected */
  alternativeHypotheses?: AlternativeHypothesis[];
  
  /** Metadata about certificate generation */
  metadata: CertificateMetadata;
}

/**
 * Visual evidence supporting verification
 */
export interface VisualEvidence {
  /** Evidence identifier */
  id: string;
  
  /** Type of visual evidence */
  type: "ui-state" | "visual-diff" | "coverage-map" | "performance-chart" | "error-state" | "console-output";
  
  /** Description of what this shows */
  description: string;
  
  /** What this evidence proves/disproves */
  verificationClaim: string;
  
  /** Path to image file */
  imagePath?: string;
  
  /** Image format */
  imageFormat?: "png" | "jpg" | "svg" | "webp";
  
  /** Image dimensions */
  dimensions?: { width: number; height: number };
  
  /** Confidence this evidence supports the claim */
  confidence: number;
  
  /** Key observations for the LLM */
  annotations: Array<{
    label: string;
    note: string;
    severity?: "info" | "warning" | "error";
  }>;
  
  /** Related code locations */
  sourceRefs?: SourceLocation[];
  
  /** Raw data for structured evidence */
  data?: Record<string, unknown>;
}

/**
 * The verification task being performed
 */
export interface VerificationTask {
  /** Task classification */
  type: "patch_equivalence" | "fault_localization" | "code_qa" | "general";
  
  /** Human-readable description */
  description: string;
  
  /** Specific question being answered */
  question?: string;
  
  /** Scope of verification */
  scope: {
    /** Files being verified */
    files?: string[];
    
    /** Tests being checked */
    tests?: string[];
    
    /** Commit SHAs if applicable */
    commits?: string[];
    
    /** Patches being compared */
    patches?: PatchReference[];
  };
}

/**
 * Reference to a patch for verification
 */
export interface PatchReference {
  /** Unique identifier */
  id: string;
  
  /** File path */
  path: string;
  
  /** Description of changes */
  description: string;
  
  /** Diff content */
  diff?: string;
  
  /** Commit SHA if from VCS */
  commitSha?: string;
  
  /** Author information */
  author?: {
    name: string;
    email?: string;
  };
  
  /** When the patch was created */
  timestamp?: string;
}

// ============================================================================
// Proof Structure Types
// ============================================================================

/**
 * A definition establishes what terms mean for the proof
 */
export interface Definition {
  /** Definition identifier (e.g., "D1") */
  id: string;
  
  /** The definition statement */
  statement: string;
  
  /** Context where this definition applies */
  context?: string;
}

/**
 * A premise is a claim with supporting evidence.
 * Every premise MUST have verifiable evidence.
 */
export interface Premise {
  /** Premise identifier (e.g., "P1") */
  id: string;
  
  /** The claim being made */
  statement: string;
  
  /** Evidence supporting the claim */
  evidence: Evidence;
  
  /** Dependencies on other premises */
  dependsOn?: string[];
  
  /** Certainty level */
  certainty: "proven" | "inferred" | "assumed";
}

/**
 * Evidence supporting a premise
 */
export interface Evidence {
  /** Description of the evidence */
  description: string;
  
  /** Source locations (file:line or URL) */
  sourceLocations: SourceLocation[];
  
  /** How the evidence was obtained */
  verificationMethod: 
    | "file_read" 
    | "code_search" 
    | "ast_analysis" 
    | "test_execution"
    | "documentation"
    | "external_reference"
    | "assumption";
  
  /** Raw evidence content */
  content?: string;
  
  /** Hash of evidence for integrity */
  contentHash?: string;
  
  /** When the evidence was collected */
  timestamp: string;
}

/**
 * Source code location
 */
export interface SourceLocation {
  /** File path */
  file: string;
  
  /** Line number (1-indexed) */
  line: number;
  
  /** Column number (optional) */
  column?: number;
  
  /** End line for multi-line ranges */
  endLine?: number;
  
  /** Function or class containing this location */
  context?: string;
  
  /** The actual code at this location */
  snippet?: string;
}

// ============================================================================
// Execution Trace Types
// ============================================================================

/**
 * An execution trace shows the complete path through code
 */
export interface ExecutionTrace {
  /** Trace identifier */
  id: string;
  
  /** Descriptive name */
  name: string;
  
  /** Associated test if applicable */
  testName?: string;
  
  /** What scenario this trace covers */
  scenario: string;
  
  /** Input values or conditions */
  input?: JsonValue;
  
  /** Expected output or behavior */
  expectedOutput?: string;
  
  /** Actual output or behavior */
  actualOutput?: string;
  
  /** Steps in the execution */
  steps: ExecutionStep[];
  
  /** Final outcome */
  outcome: TraceOutcome;
  
  /** Detailed reasoning about this trace */
  reasoning: string;
  
  /** Which patch this trace applies to (for patch equivalence) */
  patchId?: string;
}

/**
 * A single step in an execution trace
 */
export interface ExecutionStep {
  /** Step number (1-indexed) */
  stepNumber: number;
  
  /** Source location */
  location: SourceLocation;
  
  /** Function being executed */
  function?: {
    name: string;
    signature?: string;
    package?: string;
  };
  
  /** What happens at this step */
  behavior: string;
  
  /** Variable state at this point */
  variables?: VariableState[];
  
  /** Function calls made from here */
  calls?: FunctionCall[];
  
  /** Control flow (for conditionals/loops) */
  controlFlow?: {
    type: "conditional" | "loop" | "return" | "throw" | "call";
    condition?: string;
    branch?: "true" | "false" | "iteration" | "exit";
  };
  
  /** Dependencies on other steps */
  dependsOn?: number[];
}

/**
 * Variable state in execution
 */
export interface VariableState {
  /** Variable name */
  name: string;
  
  /** Type */
  type?: string;
  
  /** Value (may be truncated) */
  value: string;
  
  /** Whether this is a function parameter */
  isParameter?: boolean;
  
  /** Whether this is a return value */
  isReturn?: boolean;
}

/**
 * Function call in execution
 */
export interface FunctionCall {
  /** Function name */
  function: string;
  
  /** Arguments passed */
  arguments?: string[];
  
  /** Return value */
  returnValue?: string;
  
  /** Source location of the call */
  callSite: SourceLocation;
  
  /** Whether this call was traced */
  traced: boolean;
  
  /** If not traced, why */
  notTracedReason?: "third_party" | "builtin" | "unavailable" | "time_limit";
}

/**
 * Outcome of a trace
 */
export interface TraceOutcome {
  /** Result status */
  status: "pass" | "fail" | "error" | "unknown" | "timeout";
  
  /** Detailed description */
  description: string;
  
  /** Error if applicable */
  error?: {
    type: string;
    message: string;
    stackTrace?: string;
    location?: SourceLocation;
  };
  
  /** Exit code if from process */
  exitCode?: number;
}

// ============================================================================
// Edge Case & Analysis Types
// ============================================================================

/**
 * Edge case analysis
 */
export interface EdgeCaseAnalysis {
  /** Description of the edge case */
  description: string;
  
  /** Category */
  category: "null_input" | "empty_collection" | "boundary_value" | 
            "concurrent_access" | "resource_exhaustion" | "type_mismatch" |
            "encoding" | "timing" | "custom";
  
  /** Input triggering this edge case */
  input?: JsonValue;
  
  /** How patch 1 handles it (if patch equivalence) */
  patch1Behavior?: EdgeCaseBehavior;
  
  /** How patch 2 handles it (if patch equivalence) */
  patch2Behavior?: EdgeCaseBehavior;
  
  /** For single patch verification */
  behavior?: EdgeCaseBehavior;
  
  /** Whether outcomes match (for patch equivalence) */
  outcomesMatch?: boolean;
  
  /** Detailed reasoning */
  reasoning: string;
}

/**
 * Behavior for a specific edge case
 */
export interface EdgeCaseBehavior {
  /** Expected behavior */
  expected: string;
  
  /** Actual behavior */
  actual: string;
  
  /** Test outcome */
  testOutcome: "pass" | "fail" | "not_tested";
  
  /** Location in code */
  location?: SourceLocation;
}

/**
 * Alternative hypothesis that was considered
 */
export interface AlternativeHypothesis {
  /** Description of the hypothesis */
  hypothesis: string;
  
  /** Why it was considered */
  reasonConsidered: string;
  
  /** Evidence against it */
  counterEvidence: Evidence;
  
  /** Why it was rejected */
  rejectionReason: string;
}

// ============================================================================
// Conclusion Types
// ============================================================================

/**
 * The formal conclusion of the verification
 */
export interface Conclusion {
  /** Detailed statement */
  statement: string;
  
  /** Short summary (one sentence) */
  summary: string;
  
  /** Binary answer if applicable */
  answer: "YES" | "NO" | "UNCERTAIN" | "PARTIAL";
  
  /** Premises this conclusion follows from */
  followsFrom: string[];
  
  /** Traces this conclusion follows from */
  followsFromTraces?: string[];
  
  /** Confidence in this conclusion */
  confidence: {
    level: "high" | "medium" | "low";
    reasoning: string;
    
    /** Factors affecting confidence */
    factors?: Array<{
      factor: string;
      impact: "increases" | "decreases" | "neutral";
      description: string;
    }>;
  };
  
  /** If uncertain, what would increase confidence */
  confidenceGap?: string;
  
  /** Known limitations */
  limitations?: string[];
}

/**
 * Counterexample for negative conclusions
 */
export interface Counterexample {
  /** What test/scenario shows the failure */
  testName?: string;
  
  /** Location where failure occurs */
  location: SourceLocation;
  
  /** Input triggering the failure */
  input?: JsonValue;
  
  /** Expected result */
  expected: string;
  
  /** Actual result */
  actual: string;
  
  /** Detailed trace showing the failure */
  failureTrace: ExecutionStep[];
  
  /** Root cause analysis */
  rootCause: {
    description: string;
    location: SourceLocation;
    explanation: string;
  };
  
  /** How the failure manifests */
  manifestation: {
    type: "crash" | "wrong_output" | "infinite_loop" | "performance" | "other";
    details: string;
  };
}

// ============================================================================
// Metadata Types
// ============================================================================

/**
 * Certificate generation metadata
 */
export interface CertificateMetadata {
  /** Model used */
  model: {
    provider: string;
    modelId: string;
    version?: string;
  };
  
  /** Generation parameters */
  parameters: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  
  /** Timing */
  timing: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
  };
  
  /** Resources consumed */
  resources?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    filesRead?: number;
    functionsTraced?: number;
  };
  
  /** Tool versions */
  toolVersions?: {
    verifier: string;
    schema: string;
  };
  
  /** Session context */
  session?: {
    id: string;
    project?: string;
    branch?: string;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Certificate validation result
 */
export interface CertificateValidationResult {
  /** Whether certificate is valid */
  valid: boolean;
  
  /** Validation errors */
  errors: CertificateValidationError[];
  
  /** Validation warnings */
  warnings: CertificateValidationWarning[];
  
  /** Completeness score (0-1) */
  completeness: number;
  
  /** Quality metrics */
  metrics: {
    premiseCount: number;
    traceCount: number;
    avgEvidenceQuality: number;
    citationCoverage: number;
  };
}

/**
 * Certificate validation error
 */
export interface CertificateValidationError {
  /** Error code */
  code: string;
  
  /** Human-readable message */
  message: string;
  
  /** Path to the error in certificate */
  path: string;
  
  /** Severity */
  severity: "error" | "critical";
  
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Certificate validation warning
 */
export interface CertificateValidationWarning {
  /** Warning code */
  code: string;
  
  /** Human-readable message */
  message: string;
  
  /** Path to the warning */
  path: string;
  
  /** Suggested improvement */
  suggestion?: string;
}

// ============================================================================
// Export Types
// ============================================================================

/**
 * Export format for certificates
 */
export type CertificateExportFormat = "json" | "markdown" | "pdf" | "html";

/**
 * Export options
 */
export interface CertificateExportOptions {
  format: CertificateExportFormat;
  includeMetadata?: boolean;
  includeRawEvidence?: boolean;
  prettyPrint?: boolean;
  template?: string;
}

/**
 * Comparison result between two certificates
 */
export interface CertificateComparison {
  /** Whether conclusions agree */
  conclusionsAgree: boolean;
  
  /** Whether confidence levels match */
  confidenceMatches: boolean;
  
  /** Premises in common */
  commonPremises: string[];
  
  /** Premises only in first */
  uniqueToFirst: string[];
  
  /** Premises only in second */
  uniqueToSecond: string[];
  
  /** Trace coverage comparison */
  traceCoverage: {
    first: number;
    second: number;
    overlap: number;
  };
  
  /** Detailed differences */
  differences: Array<{
    type: "premise" | "trace" | "conclusion" | "evidence";
    description: string;
    significance: "high" | "medium" | "low";
  }>;
}
