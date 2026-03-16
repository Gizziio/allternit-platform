/**
 * Verification System
 * 
 * Implements Meta's Agentic Code Reasoning approach for execution-free verification.
 * 
 * Based on: "Agentic Code Reasoning" by Ugare & Chandra (Meta, 2026)
 * arXiv:2603.01896
 * 
 * Key insight: Structured reasoning templates requiring explicit evidence can
 * nearly halve error rates in code verification (78% → 88% on curated examples,
 * 93% on real-world patches with semi-formal reasoning).
 * 
 * This module provides:
 * - Semi-formal verification using structured certificates
 * - Empirical verification using test execution
 * - Adaptive orchestration that combines both approaches
 * - Persistent storage with querying and statistics
 * - CI/CD integration (GitHub Actions, GitLab CI)
 */

// Core verifiers
export { Verifier, type VerificationResult } from "../verifier";
export {
  SemiFormalVerifier,
  type SemiFormalVerificationResult,
  type VerificationCertificate,
  type Definition,
  type Premise,
  type ExecutionTrace,
  type CodeStep,
  type EdgeCaseAnalysis,
  type Conclusion,
  type Counterexample,
  VerificationCertificateSchema,
  createSemiFormalVerifier,
  formatCertificate,
} from "../semi-formal-verifier";

// Orchestrator
export {
  VerificationOrchestrator,
  type OrchestratedVerificationResult,
  type VerificationStrategy,
  createVerificationOrchestrator,
  verifyWithAdaptiveStrategy,
  verifyWithoutExecution,
} from "../verification-orchestrator";

// Import for internal use
import { VerificationOrchestrator } from "../verification-orchestrator";
import { storeVerification } from "./store";

// Store
export {
  VerificationStore,
  type StoredVerification,
  type VerificationQuery,
  type VerificationStats,
  storeVerification,
  getVerification,
  queryVerifications,
  getVerificationStats,
  confirmVerification,
} from "./store";

// CI/CD Integration
export {
  GitHubActionsIntegration,
  detectCIEnvironment,
  runInGitHubActions,
  type GitHubActionsConfig,
  type DetectedEnvironment,
} from "./ci-cd";

// Utility types for patch equivalence verification
export interface PatchEquivalenceRequest {
  patch1: {
    path: string;
    diff: string;
    description: string;
  };
  patch2: {
    path: string;
    diff: string;
    description: string;
  };
  testContext: {
    testPatch?: string;
    repositoryContext: string;
    relevantTests: string[];
  };
}

// Verification modes
export type VerificationMode = 
  | "empirical"      // Traditional test-based verification
  | "semi-formal"    // Reasoning-based verification (Meta's approach)
  | "both"           // Run both and compare
  | "adaptive";      // Smart selection based on confidence

// Confidence levels
export type VerificationConfidence = "high" | "medium" | "low";

// Result aggregation
export interface AggregatedVerificationResult {
  /** Overall pass/fail */
  passed: boolean;
  
  /** Confidence in the result */
  confidence: VerificationConfidence;
  
  /** Which verification methods were used */
  methodsUsed: VerificationMode[];
  
  /** Whether all methods agreed */
  consensus: boolean;
  
  /** Detailed results from each method */
  results: {
    empirical?: {
      passed: boolean;
      reason?: string;
    };
    semiFormal?: {
      passed: boolean;
      reason?: string;
      certificate?: import("../semi-formal-verifier").VerificationCertificate;
    };
  };
  
  /** Recommended next action */
  nextAction: "stop" | "continue" | "replan" | "ask_user";
  
  /** Human-readable summary */
  summary: string;
}

/**
 * Format a verification result for display
 */
export function formatVerificationResult(
  result: AggregatedVerificationResult
): string {
  const lines: string[] = [];
  
  lines.push("━".repeat(60));
  lines.push("VERIFICATION RESULT");
  lines.push("━".repeat(60));
  lines.push("");
  
  const status = result.passed ? "✓ PASSED" : "✗ FAILED";
  const confidence = result.confidence.toUpperCase();
  lines.push(`Status: ${status} (${confidence} confidence)`);
  lines.push("");
  
  lines.push(`Methods Used: ${result.methodsUsed.join(", ")}`);
  lines.push(`Consensus: ${result.consensus ? "Yes" : "DISAGREEMENT DETECTED"}`);
  lines.push("");
  
  if (result.results.semiFormal?.certificate) {
    lines.push("Certificate Summary:");
    lines.push(`  Premises: ${result.results.semiFormal.certificate.premises.length}`);
    lines.push(`  Execution Traces: ${result.results.semiFormal.certificate.executionTraces.length}`);
    lines.push(`  Conclusion: ${result.results.semiFormal.certificate.conclusion.answer}`);
    lines.push("");
  }
  
  lines.push(`Summary: ${result.summary}`);
  lines.push(`Next Action: ${result.nextAction}`);
  lines.push("");
  lines.push("━".repeat(60));
  
  return lines.join("\n");
}

/**
 * Calculate confidence based on method agreement and individual results
 */
export function calculateConfidence(
  empirical?: { passed: boolean },
  semiFormal?: { passed: boolean; confidence?: VerificationConfidence }
): VerificationConfidence {
  // If we have both and they agree, high confidence
  if (empirical && semiFormal) {
    if (empirical.passed === semiFormal.passed) {
      return "high";
    }
    return "low"; // Disagreement
  }
  
  // If only semi-formal, use its confidence
  if (semiFormal) {
    return semiFormal.confidence || "medium";
  }
  
  // If only empirical, assume medium (tests can have false positives)
  if (empirical) {
    return "medium";
  }
  
  return "low";
}

/**
 * Quick verify function for simple use cases
 */
export async function quickVerify(
  sessionId: string,
  description: string,
  options?: {
    mode?: VerificationMode;
    patches?: Array<{ path: string; content: string }>;
    testFiles?: string[];
  }
): Promise<{
  passed: boolean;
  confidence: VerificationConfidence;
  reason: string;
  certificateId?: string;
}> {
  const orchestrator = new VerificationOrchestrator(sessionId, {
    mode: options?.mode || "adaptive",
    context: {
      description,
      patches: options?.patches,
      testFiles: options?.testFiles,
    },
  });
  
  const plan = { steps: [] };
  const receipts: any[] = [];
  
  const result = await orchestrator.verify(plan as any, receipts as any);
  
  // Store the result if we have a certificate
  let certificateId: string | undefined;
  if (result.certificate) {
    try {
      certificateId = await storeVerification(result, sessionId, {
        type: "general",
        tags: [options?.mode || "adaptive"],
      });
    } catch {
      // Ignore storage errors
    }
  }
  
  return {
    passed: result.passed,
    confidence: result.confidence,
    reason: result.reason,
    certificateId,
  };
}
