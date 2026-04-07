/**
 * GIZZI Verification Types
 * 
 * Type definitions for the semi-formal verification system.
 * Based on Meta's Agentic Code Reasoning paper.
 */

// Verification types
export type VerificationType = "empirical" | "semi-formal"

// Verification status
export type VerificationStatus = 
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "error"

// Verification certificate
export interface VerificationCertificate {
  id: string
  timestamp: number
  type: VerificationType
  status: VerificationStatus
  premises: Premise[]
  reasoning: ReasoningStep[]
  conclusion: Conclusion
  evidence: VerificationEvidence[]
  metadata: VerificationMetadata
}

// Premise - starting assumption or fact
export interface Premise {
  id: string
  statement: string
  source: "code" | "test" | "spec" | "human" | "inference"
  confidence: number // 0-1
  verified: boolean
}

// Reasoning step - logical deduction
export interface ReasoningStep {
  id: string
  order: number
  premise_ids: string[]
  operation: "deduction" | "induction" | "abduction" | "analogy"
  statement: string
  result: string
  confidence: number
}

// Conclusion - final result
export interface Conclusion {
  statement: string
  confidence: number
  conditions?: string[]
  limitations?: string[]
}

// Evidence - supporting material
export interface VerificationEvidence {
  type: "test_output" | "code_snippet" | "screenshot" | "metric" | "log"
  content: string
  timestamp: number
}

// Verification metadata
export interface VerificationMetadata {
  verifier_version: string
  runtime_ms: number
  tokens_used: number
  model?: string
}

// Empirical verification (test-based)
export interface EmpiricalVerification {
  tests_run: string[]
  tests_passed: number
  tests_failed: number
  coverage?: number
  logs: string[]
}

// Semi-formal verification (reasoning-based)
export interface SemiFormalVerification {
  reasoning_chain: ReasoningStep[]
  assumptions: string[]
  proof_outline: string
  verification_level: "sketch" | "detailed" | "formal"
}

// Verification request
export interface VerificationRequest {
  id: string
  target: string // file, directory, or task
  type: VerificationType
  context?: string
  priority?: "low" | "medium" | "high"
}

// Verification result
export interface VerificationResult {
  request: VerificationRequest
  certificate: VerificationCertificate
  passed: boolean
  issues: VerificationIssue[]
}

// Verification issue
export interface VerificationIssue {
  severity: "error" | "warning" | "info"
  message: string
  location?: string
  suggestion?: string
}

// Verifier interface
export interface Verifier {
  name: string
  type: VerificationType
  canVerify(target: string): Promise<boolean>
  verify(request: VerificationRequest): Promise<VerificationResult>
}
