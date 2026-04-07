/**
 * Visual Capture Manager
 * 
 * Orchestrates all visual capture providers to generate evidence for verification.
 */

import type { VisualArtifact, VisualArtifactType } from "./types";
import type { CaptureContext, CaptureOptions } from "./providers/base";
import { ConsoleCaptureProvider } from "./providers/console";
import { CoverageCaptureProvider } from "./providers/coverage";
import { UIStateCaptureProvider } from "./providers/ui-state";
import { VisualDiffCaptureProvider } from "./providers/visual-diff";
import { ErrorStateCaptureProvider } from "./providers/error-state";

export interface VisualCaptureManagerOptions {
  /** Output directory for captures */
  outputDir: string;
  
  /** Which artifact types to capture */
  enabledTypes?: VisualArtifactType[];
  
  /** Include base64 image data in artifacts */
  includeBase64?: boolean;
  
  /** Viewport for UI captures */
  viewport?: { width: number; height: number };
  
  /** Maximum image dimensions */
  maxImageDimensions?: { width: number; height: number };
}

export interface CaptureResult {
  /** Session ID */
  sessionId: string;
  
  /** Verification ID */
  verificationId: string;
  
  /** All captured artifacts */
  artifacts: VisualArtifact[];
  
  /** Artifacts grouped by type */
  byType: Record<VisualArtifactType, VisualArtifact[]>;
  
  /** Artifacts relevant to verification claims */
  evidence: VisualArtifact[];
  
  /** Summary for LLM context */
  summary: {
    totalArtifacts: number;
    typesCaptured: VisualArtifactType[];
    hasVisualEvidence: boolean;
    highConfidenceArtifacts: number;
  };
}

export class VisualCaptureManager {
  private options: VisualCaptureManagerOptions;
  private providers: Map<VisualArtifactType, any> = new Map();
  
  constructor(options: VisualCaptureManagerOptions) {
    this.options = options;
    this.initializeProviders();
  }
  
  private initializeProviders(): void {
    const baseOptions: CaptureOptions = {
      outputDir: this.options.outputDir,
      viewport: this.options.viewport,
      includeBase64: this.options.includeBase64,
      maxDimensions: this.options.maxImageDimensions,
    };
    
    const enabledTypes = this.options.enabledTypes || [
      "console-output",
      "coverage-map",
      "ui-state",
    ];
    
    for (const type of enabledTypes) {
      switch (type) {
        case "console-output":
          this.providers.set(type, new ConsoleCaptureProvider(baseOptions));
          break;
        case "coverage-map":
          this.providers.set(type, new CoverageCaptureProvider(baseOptions));
          break;
        case "ui-state":
          this.providers.set(type, new UIStateCaptureProvider(baseOptions));
          break;
        case "visual-diff":
          this.providers.set(type, new VisualDiffCaptureProvider(baseOptions));
          break;
        case "error-state":
          this.providers.set(type, new ErrorStateCaptureProvider(baseOptions));
          break;
        // Add more providers as implemented
      }
    }
  }
  
  /**
   * Capture visual evidence for verification
   */
  async capture(context: CaptureContext): Promise<CaptureResult> {
    const artifacts: VisualArtifact[] = [];
    const byType: Record<string, VisualArtifact[]> = {};
    
    // Check which providers are available
    const availableProviders: Array<{ type: VisualArtifactType; provider: any }> = [];
    
    for (const [type, provider] of this.providers) {
      const available = await provider.checkAvailability();
      if (available) {
        availableProviders.push({ type, provider });
      }
    }
    
    // Run all available providers
    await Promise.all(
      availableProviders.map(async ({ type, provider }) => {
        try {
          const typeArtifacts = await provider.capture(context);
          artifacts.push(...typeArtifacts);
          byType[type] = typeArtifacts;
        } catch (error) {
          console.error(`Visual capture failed for ${type}:`, error);
          byType[type] = [];
        }
      })
    );
    
    // Sort artifacts by confidence
    artifacts.sort((a, b) => b.confidence - a.confidence);
    
    // Determine evidence (high confidence artifacts)
    const evidence = artifacts.filter(a => a.confidence >= 0.7);
    
    const result: CaptureResult = {
      sessionId: context.sessionId,
      verificationId: context.verificationId,
      artifacts,
      byType,
      evidence,
      summary: {
        totalArtifacts: artifacts.length,
        typesCaptured: Object.keys(byType) as VisualArtifactType[],
        hasVisualEvidence: evidence.length > 0,
        highConfidenceArtifacts: artifacts.filter(a => a.confidence >= 0.8).length,
      },
    };
    
    return result;
  }
  
  /**
   * Format all artifacts for inclusion in LLM prompt
   */
  formatForLLM(result: CaptureResult): string {
    const sections: string[] = [];
    
    sections.push("=" .repeat(60));
    sections.push("VISUAL EVIDENCE FOR VERIFICATION");
    sections.push("=" .repeat(60));
    sections.push("");
    
    // Summary
    sections.push(`Total Artifacts: ${result.summary.totalArtifacts}`);
    sections.push(`Types: ${result.summary.typesCaptured.join(", ")}`);
    sections.push(`High Confidence: ${result.summary.highConfidenceArtifacts}`);
    sections.push("");
    
    // Each artifact
    for (const artifact of result.artifacts) {
      sections.push("-".repeat(40));
      sections.push(`[${artifact.type.toUpperCase()}] ${artifact.description}`);
      sections.push(`ID: ${artifact.id}`);
      sections.push(`Claim: ${artifact.verificationClaim}`);
      sections.push(`Confidence: ${(artifact.confidence * 100).toFixed(0)}%`);
      sections.push("");
      
      // Annotations
      if (artifact.annotations.length > 0) {
        sections.push("Annotations:");
        for (const ann of artifact.annotations) {
          const severity = ann.severity ? `[${ann.severity.toUpperCase()}] ` : "";
          sections.push(`  - ${severity}${ann.label}: ${ann.note}`);
        }
        sections.push("");
      }
      
      // LLM-formatted context
      sections.push("Details:");
      sections.push(artifact.llmContext);
      sections.push("");
      
      // Image reference
      if (artifact.image) {
        sections.push(`[Visual: ${artifact.image.path}]`);
        sections.push(`Dimensions: ${artifact.image.width}x${artifact.image.height}`);
        sections.push("");
      }
    }
    
    sections.push("=" .repeat(60));
    
    return sections.join("\n");
  }
  
  /**
   * Get artifacts relevant to a specific verification claim
   */
  getEvidenceForClaim(result: CaptureResult, claim: string): VisualArtifact[] {
    // Simple keyword matching - could use embeddings in production
    const keywords = claim.toLowerCase().split(/\s+/);
    
    return result.artifacts.filter(artifact => {
      const text = `${artifact.description} ${artifact.verificationClaim} ${artifact.llmContext}`.toLowerCase();
      return keywords.some(kw => text.includes(kw));
    });
  }
  
  /**
   * Export artifacts to a format suitable for storage
   */
  async exportArtifacts(result: CaptureResult): Promise<string> {
    const fs = await import("fs/promises");
    const path = await import("path");
    
    const exportDir = path.join(this.options.outputDir, result.verificationId);
    await fs.mkdir(exportDir, { recursive: true });
    
    // Export metadata
    const metadata = {
      sessionId: result.sessionId,
      verificationId: result.verificationId,
      summary: result.summary,
      artifacts: result.artifacts.map(a => ({
        id: a.id,
        type: a.type,
        description: a.description,
        claim: a.verificationClaim,
        confidence: a.confidence,
        imagePath: a.image?.path,
      })),
    };
    
    await fs.writeFile(
      path.join(exportDir, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );
    
    // Export full data
    await fs.writeFile(
      path.join(exportDir, "artifacts.json"),
      JSON.stringify(result.artifacts, null, 2)
    );
    
    // Export LLM context
    await fs.writeFile(
      path.join(exportDir, "llm-context.txt"),
      this.formatForLLM(result)
    );
    
    return exportDir;
  }
}
