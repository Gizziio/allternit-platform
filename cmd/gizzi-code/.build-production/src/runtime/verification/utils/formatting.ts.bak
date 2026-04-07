/**
 * Formatting Utilities
 * 
 * Format verification certificates and results for display.
 */

import type {
  VerificationCertificate,
  OrchestratedVerificationResult,
  VerificationConfidence,
} from "../types";

/** Aggregated result type - alias for orchestrated result */
type AggregatedVerificationResult = OrchestratedVerificationResult;

/**
 * Format a certificate as markdown
 */
export function formatCertificate(
  certificate: VerificationCertificate,
  options: {
    includeMetadata?: boolean;
    includeRawEvidence?: boolean;
  } = {}
): string {
  const lines: string[] = [];
  
  // Header
  lines.push("# Verification Certificate");
  lines.push("");
  lines.push(`**ID:** ${certificate.id}`);
  lines.push(`**Generated:** ${new Date(certificate.timestamp).toLocaleString()}`);
  lines.push(`**Version:** ${certificate.version}`);
  lines.push("");
  
  // Task
  lines.push("## Task");
  lines.push(`**Type:** ${certificate.task.type}`);
  lines.push(`**Description:** ${certificate.task.description}`);
  if (certificate.task.question) {
    lines.push(`**Question:** ${certificate.task.question}`);
  }
  lines.push("");
  
  // Definitions
  if (certificate.definitions.length > 0) {
    lines.push("## Definitions");
    for (const def of certificate.definitions) {
      lines.push(`- **${def.id}:** ${def.statement}`);
    }
    lines.push("");
  }
  
  // Premises
  lines.push("## Premises");
  for (const premise of certificate.premises) {
    lines.push(`### ${premise.id}`);
    lines.push(`**Statement:** ${premise.statement}`);
    lines.push(`**Certainty:** ${premise.certainty}`);
    
    if (premise.evidence) {
      lines.push(`**Evidence:** ${premise.evidence.description}`);
      lines.push(`**Method:** ${premise.evidence.verificationMethod}`);
      
      if (premise.evidence.sourceLocations.length > 0) {
        lines.push("**Source Locations:**");
        for (const loc of premise.evidence.sourceLocations) {
          lines.push(`- \`${loc.file}:${loc.line}\`${loc.context ? ` (${loc.context})` : ""}`);
          if (loc.snippet && options.includeRawEvidence) {
            lines.push(`  \`\`\`${loc.snippet}\`\`\``);
          }
        }
      }
    }
    
    if (premise.dependsOn && premise.dependsOn.length > 0) {
      lines.push(`**Depends on:** ${premise.dependsOn.join(", ")}`);
    }
    
    lines.push("");
  }
  
  // Execution Traces
  lines.push("## Execution Traces");
  for (const trace of certificate.executionTraces) {
    lines.push(`### ${trace.id}: ${trace.name}`);
    
    if (trace.testName) {
      lines.push(`**Test:** ${trace.testName}`);
    }
    
    lines.push(`**Scenario:** ${trace.scenario}`);
    lines.push(`**Outcome:** ${trace.outcome.status.toUpperCase()}`);
    lines.push("");
    
    lines.push("**Steps:**");
    for (const step of trace.steps) {
      const func = step.function ? ` (${step.function.name})` : "";
      lines.push(`${step.stepNumber}. \`${step.location.file}:${step.location.line}\`${func}`);
      lines.push(`   - ${step.behavior}`);
      
      if (step.variables && step.variables.length > 0) {
        lines.push(`   - Variables: ${step.variables.map(v => `${v.name}=${v.value}`).join(", ")}`);
      }
    }
    lines.push("");
    
    lines.push(`**Reasoning:** ${trace.reasoning}`);
    lines.push("");
  }
  
  // Edge Cases
  if (certificate.edgeCases.length > 0) {
    lines.push("## Edge Cases");
    for (const edgeCase of certificate.edgeCases) {
      lines.push(`- **${edgeCase.category}:** ${edgeCase.description}`);
      
      if (edgeCase.patch1Behavior && edgeCase.patch2Behavior) {
        lines.push(`  - Patch 1: ${edgeCase.patch1Behavior.actual}`);
        lines.push(`  - Patch 2: ${edgeCase.patch2Behavior.actual}`);
        lines.push(`  - Match: ${edgeCase.outcomesMatch ? "YES" : "NO"}`);
      } else if (edgeCase.behavior) {
        lines.push(`  - Behavior: ${edgeCase.behavior.actual}`);
      }
    }
    lines.push("");
  }
  
  // Conclusion
  lines.push("## Conclusion");
  lines.push(`**Statement:** ${certificate.conclusion.statement}`);
  lines.push(`**Summary:** ${certificate.conclusion.summary}`);
  lines.push(`**Answer:** ${certificate.conclusion.answer}`);
  lines.push(`**Follows from:** ${certificate.conclusion.followsFrom.join(", ")}`);
  lines.push(`**Confidence:** ${certificate.conclusion.confidence.level}`);
  lines.push(`**Reasoning:** ${certificate.conclusion.confidence.reasoning}`);
  
  if (certificate.conclusion.limitations && certificate.conclusion.limitations.length > 0) {
    lines.push("**Limitations:**");
    for (const limitation of certificate.conclusion.limitations) {
      lines.push(`- ${limitation}`);
    }
  }
  lines.push("");
  
  // Counterexample
  if (certificate.counterexample) {
    lines.push("## Counterexample");
    lines.push(`**Test:** ${certificate.counterexample.testName || "N/A"}`);
    lines.push(`**Location:** \`${certificate.counterexample.location.file}:${certificate.counterexample.location.line}\``);
    lines.push(`**Expected:** ${certificate.counterexample.expected}`);
    lines.push(`**Actual:** ${certificate.counterexample.actual}`);
    lines.push("");
    lines.push(`**Root Cause:** ${certificate.counterexample.rootCause.explanation}`);
    lines.push("");
  }
  
  // Metadata
  if (options.includeMetadata && certificate.metadata) {
    lines.push("## Metadata");
    lines.push(`**Model:** ${certificate.metadata.model.provider}/${certificate.metadata.model.modelId}`);
    lines.push(`**Duration:** ${certificate.metadata.timing.durationMs}ms`);
    
    if (certificate.metadata.resources) {
      const r = certificate.metadata.resources;
      lines.push(`**Tokens:** ${r.totalTokens || "N/A"}`);
      lines.push(`**Files Read:** ${r.filesRead || "N/A"}`);
    }
    lines.push("");
  }
  
  return lines.join("\n");
}

/**
 * Format verification result for display
 */
export function formatVerificationResult(
  result: OrchestratedVerificationResult | AggregatedVerificationResult
): string {
  const lines: string[] = [];
  
  lines.push("━".repeat(60));
  lines.push("VERIFICATION RESULT");
  lines.push("━".repeat(60));
  lines.push("");
  
  // Status
  const status = result.passed ? "✓ PASSED" : "✗ FAILED";
  const confidence = result.confidence.toUpperCase();
  lines.push(`Status: ${status} (${confidence} confidence)`);
  lines.push("");
  
  // Methods
  lines.push(`Methods Used: ${result.methodsUsed.join(", ")}`);
  lines.push(`Consensus: ${result.consensus ? "Yes" : "DISAGREEMENT DETECTED"}`);
  lines.push("");
  
  // Certificate summary
  if ("certificate" in result && result.certificate) {
    lines.push("Certificate Summary:");
    lines.push(`  Premises: ${result.certificate.premises.length}`);
    lines.push(`  Execution Traces: ${result.certificate.executionTraces.length}`);
    lines.push(`  Conclusion: ${result.certificate.conclusion.answer}`);
    lines.push("");
  }
  
  // Disagreement details
  if ("disagreement" in result && result.disagreement) {
    lines.push("DISAGREEMENT DETAILS:");
    lines.push(`  Empirical: ${result.disagreement.empiricalPassed ? "PASSED" : "FAILED"}`);
    lines.push(`  Semi-formal: ${result.disagreement.semiFormalPassed ? "PASSED" : "FAILED"}`);
    lines.push(`  Analysis: ${result.disagreement.analysis}`);
    lines.push("");
  }
  
  // Reason
  lines.push(`Summary: ${result.reason}`);
  lines.push(`Next Action: ${result.nextAction}`);
  lines.push("");
  lines.push("━".repeat(60));
  
  return lines.join("\n");
}

/**
 * Calculate confidence based on method agreement
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
  
  // If only empirical, assume medium
  if (empirical) {
    return "medium";
  }
  
  return "low";
}

/**
 * Format a table of verification results
 */
export function formatVerificationTable(
  results: Array<{
    id: string;
    timestamp: string;
    passed: boolean;
    confidence: VerificationConfidence;
    type: string;
  }>
): string {
  if (results.length === 0) {
    return "No verifications found.";
  }
  
  const lines: string[] = [];
  
  // Header
  lines.push("| ID | Timestamp | Result | Confidence | Type |");
  lines.push("|------|-----------|--------|------------|------|");
  
  // Rows
  for (const result of results) {
    const date = new Date(result.timestamp).toLocaleDateString();
    const status = result.passed ? "✓" : "✗";
    lines.push(
      `| ${result.id.slice(0, 8)}... | ${date} | ${status} | ${result.confidence} | ${result.type} |`
    );
  }
  
  return lines.join("\n");
}

/**
 * Format statistics summary
 */
export function formatStatisticsSummary(stats: {
  total: number;
  passed: number;
  failed: number;
  accuracy?: number;
}): string {
  const lines: string[] = [];
  
  lines.push("## Verification Statistics");
  lines.push("");
  lines.push(`Total: ${stats.total}`);
  lines.push(`Passed: ${stats.passed} (${((stats.passed / stats.total) * 100).toFixed(1)}%)`);
  lines.push(`Failed: ${stats.failed} (${((stats.failed / stats.total) * 100).toFixed(1)}%)`);
  
  if (stats.accuracy !== undefined) {
    lines.push(`Accuracy: ${(stats.accuracy * 100).toFixed(1)}%`);
  }
  
  return lines.join("\n");
}
