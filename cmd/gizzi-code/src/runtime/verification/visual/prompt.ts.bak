/**
 * Prompt Building Utilities for Visual Evidence
 * 
 * Helper functions to format visual evidence for LLM consumption.
 */

import type { VisualArtifact } from "./types";
import type { CaptureResult } from "./manager";

/**
 * Builds a complete prompt context from capture results
 */
export function buildPromptContext(
  result: CaptureResult,
  options: {
    includeSummary?: boolean;
    maxArtifacts?: number;
  } = {},
): string {
  const { includeSummary = true, maxArtifacts = 50 } = options;
  
  const sections: string[] = [];
  
  // Header
  sections.push("=".repeat(60));
  sections.push("VISUAL EVIDENCE FOR VERIFICATION");
  sections.push("=".repeat(60));
  
  // Summary
  if (includeSummary) {
    sections.push("");
    sections.push(`Session: ${result.sessionId}`);
    sections.push(`Verification: ${result.verificationId}`);
    sections.push(`Total Artifacts: ${result.summary.totalArtifacts}`);
    sections.push(`Types Captured: ${result.summary.typesCaptured.join(", ")}`);
    sections.push(`Has Visual Evidence: ${result.summary.hasVisualEvidence ? "Yes" : "No"}`);
    sections.push(`High Confidence Artifacts: ${result.summary.highConfidenceArtifacts}`);
  }
  
  // Artifacts
  const artifactsToShow = result.artifacts.slice(0, maxArtifacts);
  
  if (artifactsToShow.length > 0) {
    sections.push("");
    sections.push("-".repeat(60));
    sections.push("ARTIFACTS");
    sections.push("-".repeat(60));
    
    for (const artifact of artifactsToShow) {
      sections.push("");
      sections.push(formatArtifactForLLM(artifact));
    }
    
    if (result.artifacts.length > maxArtifacts) {
      sections.push("");
      sections.push(`... and ${result.artifacts.length - maxArtifacts} more artifacts`);
    }
  }
  
  sections.push("");
  sections.push("=".repeat(60));
  
  return sections.join("\n");
}

/**
 * Formats a single artifact for LLM consumption
 */
export function formatArtifactForLLM(artifact: VisualArtifact): string {
  const lines: string[] = [];
  
  // Type and description
  const typeLabel = artifact.type.toUpperCase().replace(/-/g, " ");
  lines.push(`[${typeLabel}] ${artifact.description}`);
  
  // Verification claim
  if (artifact.verificationClaim) {
    lines.push(`Claim: ${artifact.verificationClaim}`);
  }
  
  // Confidence
  if (artifact.confidence !== undefined) {
    const confidence = Math.round(artifact.confidence * 100);
    lines.push(`Confidence: ${confidence}%`);
  }
  
  // LLM Context (pre-formatted string from provider)
  if (artifact.llmContext) {
    lines.push("");
    lines.push(artifact.llmContext);
  }
  
  // Data summary if available
  if (artifact.data) {
    lines.push("\n[Structured Data]");
    const data = artifact.data as Record<string, any>;
    
    // Coverage data
    if (artifact.type === "coverage-map" && data.metrics) {
      const m = data.metrics;
      lines.push(`Lines: ${m.lines?.covered}/${m.lines?.total} (${m.lines?.percentage?.toFixed(1)}%)`);
      lines.push(`Functions: ${m.functions?.covered}/${m.functions?.total}`);
    }
    
    // Console data
    if (artifact.type === "console-output") {
      if (data.exitCode !== undefined) {
        lines.push(`Exit Code: ${data.exitCode}`);
      }
      if (data.testResults) {
        const t = data.testResults;
        lines.push(`Tests: ${t.passed} passed, ${t.failed} failed, ${t.skipped} skipped`);
      }
    }
    
    // Error state data
    if (artifact.type === "error-state" && data.errorType) {
      lines.push(`Error Type: ${data.errorType}`);
      if (data.message) {
        lines.push(`Message: ${data.message}`);
      }
    }
    
    // UI state data
    if (artifact.type === "ui-state") {
      if (data.url) lines.push(`URL: ${data.url}`);
      if (data.viewport) {
        lines.push(`Viewport: ${data.viewport.width}x${data.viewport.height}`);
      }
    }
    
    // Visual diff data
    if (artifact.type === "visual-diff" && data.diff) {
      const diff = data.diff;
      lines.push(`Pixel Difference: ${diff.pixelDifference}`);
      if (diff.changedRegions?.length) {
        lines.push(`Changed Regions: ${diff.changedRegions.length}`);
      }
    }
  }
  
  // Annotations
  if (artifact.annotations?.length) {
    lines.push("\n[Annotations]");
    for (const ann of artifact.annotations.slice(0, 5)) {
      const severity = ann.severity ? `[${ann.severity.toUpperCase()}] ` : "";
      lines.push(`- ${severity}${ann.label}: ${ann.note}`);
    }
    if (artifact.annotations.length > 5) {
      lines.push(`... and ${artifact.annotations.length - 5} more annotations`);
    }
  }
  
  // Image reference
  if (artifact.image) {
    lines.push(`\n[Image] Path: ${artifact.image.path}`);
    lines.push(`Dimensions: ${artifact.image.width}x${artifact.image.height}`);
  }
  
  // Timestamp
  if (artifact.timestamp) {
    lines.push(`\nCaptured: ${new Date(artifact.timestamp).toISOString()}`);
  }
  
  return lines.join("\n");
}

/**
 * Creates a concise summary for system prompts
 */
export function createSystemPromptAddition(result: CaptureResult): string {
  const parts: string[] = [];
  
  parts.push("## Visual Evidence");
  parts.push("");
  
  if (!result.summary.hasVisualEvidence) {
    parts.push("No visual evidence captured.");
    return parts.join("\n");
  }
  
  // Quick stats
  parts.push(`Artifacts: ${result.summary.totalArtifacts} total, ${result.summary.highConfidenceArtifacts} high confidence`);
  parts.push(`Types: ${result.summary.typesCaptured.join(", ")}`);
  parts.push("");
  
  // Key artifacts only (those with confidence < 1.0)
  const keyArtifacts = result.artifacts.filter(a => a.confidence < 1.0).slice(0, 5);
  
  if (keyArtifacts.length > 0) {
    parts.push("Key findings:");
    for (const artifact of keyArtifacts) {
      const confidence = Math.round(artifact.confidence * 100);
      parts.push(`- [${artifact.type}] ${artifact.description.substring(0, 60)}... (${confidence}% confidence)`);
    }
  }
  
  parts.push("");
  parts.push("Use this evidence to verify changes. Check for console errors, coverage gaps, and visual regressions.");
  
  return parts.join("\n");
}
