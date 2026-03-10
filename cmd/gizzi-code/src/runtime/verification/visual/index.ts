/**
 * Visual Evidence for Agent Verification
 * 
 * Provides visual artifacts (screenshots, coverage maps, etc.) that help
 * AI agents verify code correctness beyond what text analysis can provide.
 * 
 * @example
 * ```typescript
 * import { VisualCaptureManager } from "./visual";
 * 
 * const manager = new VisualCaptureManager({
 *   outputDir: "./visual-evidence",
 *   enabledTypes: ["ui-state", "coverage-map", "console-output"],
 * });
 * 
 * const result = await manager.capture({
 *   sessionId: "sess_123",
 *   verificationId: "ver_456",
 *   cwd: "./my-project",
 *   files: ["src/Button.tsx"],
 *   testFiles: ["src/Button.test.tsx"],
 * });
 * 
 * // Include in verification prompt
 * const prompt = `
 *   Verify this code:
 *   ${code}
 *   
 *   Visual Evidence:
 *   ${manager.formatForLLM(result)}
 * `;
 * ```
 */

// Types
export type {
  VisualArtifact,
  VisualArtifactType,
  VisualAnnotation,
  SourceReference,
  ImageData,
  UIStateArtifact,
  VisualDiffArtifact,
  CoverageMapArtifact,
  PerformanceChartArtifact,
  ErrorStateArtifact,
  StructureDiagramArtifact,
  ConsoleOutputArtifact,
} from "./types";

// Manager
export {
  VisualCaptureManager,
  type VisualCaptureManagerOptions,
  type CaptureResult,
} from "./manager";

// Browser automation adapters
export {
  BrowserAdapter,
  checkDevServer,
  type BrowserAdapterOptions,
  type ScreenshotResult,
  type RenderResult as BrowserRenderResult,
} from "./browser/adapter";

// Playwright fallback (if needed)
export {
  PlaywrightBrowser,
  type ScreenshotOptions,
  type ComponentRenderOptions,
  type PageRenderOptions,
  type RenderResult,
  type ComputedStyleResult,
  type ConsoleLogEntry,
} from "./browser/playwright";

// Providers
export {
  VisualCaptureProvider,
  type CaptureContext,
  type CaptureOptions,
} from "./providers/base";

export {
  ConsoleCaptureProvider,
  type ConsoleCaptureOptions,
} from "./providers/console";

export {
  CoverageCaptureProvider,
} from "./providers/coverage";

export {
  UIStateCaptureProvider,
} from "./providers/ui-state";

export {
  VisualDiffCaptureProvider,
} from "./providers/visual-diff";

export {
  ErrorStateCaptureProvider,
} from "./providers/error-state";

// Utility functions
export function artifactToLLMContext(artifact: VisualArtifact): string {
  const lines: string[] = [];
  
  lines.push(`## ${artifact.type}: ${artifact.description}`);
  lines.push("");
  lines.push(`**Claim:** ${artifact.verificationClaim}`);
  lines.push(`**Confidence:** ${(artifact.confidence * 100).toFixed(0)}%`);
  lines.push("");
  
  if (artifact.annotations.length > 0) {
    lines.push("**Key Points:**");
    for (const ann of artifact.annotations) {
      const icon = ann.severity === "error" ? "❌" : 
                   ann.severity === "warning" ? "⚠️" : 
                   ann.color === "green" ? "✅" : "ℹ️";
      lines.push(`- ${icon} **${ann.label}**: ${ann.note}`);
    }
    lines.push("");
  }
  
  lines.push("**Details:**");
  lines.push(artifact.llmContext);
  lines.push("");
  
  return lines.join("\n");
}

export function summarizeArtifacts(artifacts: VisualArtifact[]): string {
  if (artifacts.length === 0) return "No visual evidence captured.";
  
  const byType = artifacts.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const highConfidence = artifacts.filter(a => a.confidence >= 0.8).length;
  
  const lines: string[] = [];
  lines.push(`Captured ${artifacts.length} visual artifacts:`);
  
  for (const [type, count] of Object.entries(byType)) {
    lines.push(`  - ${type}: ${count}`);
  }
  
  lines.push(`High confidence evidence: ${highConfidence}/${artifacts.length}`);
  
  return lines.join("\n");
}
