/**
 * Visual Evidence + A2R Autoland Integration
 * 
 * Integrates the visual evidence capture system with the existing A2R Autoland
 * protocol (Rust-based gate system in 0-substrate).
 * 
 * This adapter adds visual verification as a pre-condition before the autoland
 * gate allows changes to be landed from `.a2r/runner/{wih_id}/` to project root.
 * 
 * Flow:
 * 1. WIH completes with PASS status
 * 2. Visual evidence is captured (UI state, coverage, console)
 * 3. Visual verification result is written to WIH metadata
 * 4. Autoland gate checks visual verification before landing
 * 5. Changes are landed only if visual verification passes
 */

import { Log } from "@/shared/util/log";
import { Bus } from "@/shared/bus";
import type { VisualCaptureManager } from "../manager";
import type { DeterministicCaptureResult } from "./deterministic";

const log = Log.create({ service: "visual-autoland-adapter" });

// ============================================================================
// Types
// ============================================================================

export interface VisualAutolandConfig {
  /** Enable visual verification as autoland pre-condition */
  enabled: boolean;
  /** Minimum confidence score (0-1) to allow landing */
  minConfidence: number;
  /** Require visual evidence for UI-related changes */
  requireForUIChanges: boolean;
  /** Capture types to require */
  requiredTypes: Array<"ui-state" | "coverage-map" | "console-output" | "visual-diff">;
  /** Auto-capture on WIH completion */
  autoCapture: boolean;
}

export interface WihVisualEvidence {
  wihId: string;
  sessionId?: string;
  capturedAt: number;
  result: DeterministicCaptureResult;
  passed: boolean;
  confidence: number;
}

// ============================================================================
// State
// ============================================================================

let visualManager: VisualCaptureManager | undefined;

const config: VisualAutolandConfig = {
  enabled: true,
  minConfidence: 0.7,
  requireForUIChanges: true,
  requiredTypes: ["console-output", "coverage-map"],
  autoCapture: true,
};

// Store visual evidence by WIH ID
const wihEvidence = new Map<string, WihVisualEvidence>();

// ============================================================================
// Configuration
// ============================================================================

export function configure(options: Partial<VisualAutolandConfig>): void {
  Object.assign(config, options);
  log.info("Visual autoland adapter configured", config);
}

export function setVisualManager(manager: VisualCaptureManager): void {
  visualManager = manager;
}

export function getConfig(): VisualAutolandConfig {
  return { ...config };
}

// ============================================================================
// Core Integration Functions
// ============================================================================

/**
 * Capture visual evidence for a WIH before autoland
 * This should be called when a WIH is completed with PASS status
 */
export async function captureForWih(
  wihId: string,
  options: {
    sessionId?: string;
    changedFiles?: string[];
    timeout?: number;
  } = {},
): Promise<WihVisualEvidence | null> {
  if (!visualManager) {
    log.warn("Visual manager not set, skipping capture");
    return null;
  }

  if (!config.enabled) {
    log.debug("Visual autoland disabled, skipping capture");
    return null;
  }

  log.info("Capturing visual evidence for WIH", { wihId });

  try {
    const { captureVisualEvidenceDeterministic } = await import("./deterministic");

    const result = await captureVisualEvidenceDeterministic(
      visualManager,
      options.sessionId || wihId,
      {
        waitForServer: true,
        serverTimeout: options.timeout || 30000,
        changedFiles: options.changedFiles,
        injectIntoContext: true,
      },
    );

    // Calculate overall confidence
    const avgConfidence = result.artifacts.length > 0
      ? result.artifacts.reduce((sum, a) => sum + (a.confidence || 0), 0) / result.artifacts.length
      : 1;

    // Check if required types are present
    const hasRequiredTypes = config.requiredTypes.every(type =>
      result.artifacts.some(a => a.type === type),
    );

    // Determine if visual verification passed
    const passed = result.success && 
                   avgConfidence >= config.minConfidence &&
                   hasRequiredTypes;

    const evidence: WihVisualEvidence = {
      wihId,
      sessionId: options.sessionId,
      capturedAt: Date.now(),
      result,
      passed,
      confidence: avgConfidence,
    };

    wihEvidence.set(wihId, evidence);

    log.info("Visual evidence captured", {
      wihId,
      passed,
      confidence: avgConfidence,
      artifacts: result.artifacts.length,
    });

    return evidence;

  } catch (error) {
    log.error("Failed to capture visual evidence", { wihId, error });
    return null;
  }
}

/**
 * Check if a WIH has passed visual verification
 * Called by the autoland gate before allowing landing
 */
export function checkWihVisualStatus(wihId: string): {
  allowed: boolean;
  reason?: string;
  evidence?: WihVisualEvidence;
} {
  if (!config.enabled) {
    return { allowed: true };
  }

  const evidence = wihEvidence.get(wihId);

  if (!evidence) {
    // If auto-capture is enabled but evidence not found, we should wait
    if (config.autoCapture) {
      return {
        allowed: false,
        reason: "Visual evidence not yet captured for WIH",
      };
    }
    // If auto-capture is disabled, allow landing without visual evidence
    return { allowed: true };
  }

  if (!evidence.passed) {
    return {
      allowed: false,
      reason: `Visual verification failed: confidence ${evidence.confidence.toFixed(2)} below threshold ${config.minConfidence}`,
      evidence,
    };
  }

  return {
    allowed: true,
    evidence,
  };
}

/**
 * Get visual evidence for a WIH
 */
export function getWihEvidence(wihId: string): WihVisualEvidence | undefined {
  return wihEvidence.get(wihId);
}

/**
 * Format visual evidence for CLI output or logs
 */
export function formatEvidenceForDisplay(evidence: WihVisualEvidence): string {
  const lines: string[] = [];
  
  lines.push(`WIH: ${evidence.wihId}`);
  lines.push(`Status: ${evidence.passed ? "✅ PASS" : "❌ FAIL"}`);
  lines.push(`Confidence: ${(evidence.confidence * 100).toFixed(1)}%`);
  lines.push(`Captured: ${new Date(evidence.capturedAt).toISOString()}`);
  lines.push(`Artifacts: ${evidence.result.artifacts.length}`);
  
  if (evidence.result.errors.length > 0) {
    lines.push("\nErrors:");
    for (const error of evidence.result.errors) {
      lines.push(`  - ${error}`);
    }
  }

  lines.push("\nArtifact Summary:");
  for (const artifact of evidence.result.artifacts) {
    const confidence = Math.round((artifact.confidence || 0) * 100);
    lines.push(`  [${artifact.type}] ${artifact.description.substring(0, 50)}... (${confidence}%)`);
  }

  return lines.join("\n");
}

// ============================================================================
// Autoland Gate Integration
// ============================================================================

/**
 * Pre-land hook for the autoland gate
 * Returns whether landing should be allowed
 */
export async function preLandHook(wihId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  if (!config.enabled) {
    return { allowed: true };
  }

  // Check if we already have evidence
  let evidence = wihEvidence.get(wihId);

  // If not and auto-capture is enabled, capture now
  if (!evidence && config.autoCapture && visualManager) {
    evidence = (await captureForWih(wihId)) || undefined;
  }

  if (!evidence) {
    return {
      allowed: false,
      reason: "Visual evidence required but not available",
    };
  }

  if (!evidence.passed) {
    return {
      allowed: false,
      reason: `Visual verification failed: ${(evidence.confidence * 100).toFixed(1)}% confidence below ${(config.minConfidence * 100).toFixed(0)}% threshold`,
    };
  }

  return { allowed: true };
}

/**
 * Post-land hook for the autoland gate
 * Called after successful landing
 */
export async function postLandHook(
  wihId: string,
  result: { success: boolean; commitSha?: string },
): Promise<void> {
  const evidence = wihEvidence.get(wihId);
  
  if (evidence && result.success) {
    log.info("WIH landed with visual verification", {
      wihId,
      commitSha: result.commitSha,
      confidence: evidence.confidence,
    });
    
    // Evidence could be archived here if needed
  }

  // Clean up evidence after landing (or archive it)
  // wihEvidence.delete(wihId);
}

// ============================================================================
// Event Integration
// ============================================================================

/**
 * Initialize event listeners for automatic visual capture
 */
export function initialize(): void {
  if (!config.enabled) {
    log.info("Visual autoland adapter disabled");
    return;
  }

  // Listen for WIH completion events
  // These would be emitted by the Rust substrate system
  // For now, we provide a hook-based integration

  log.info("Visual autoland adapter initialized");
}

/**
 * Clean up old evidence
 */
export function cleanup(maxAgeHours: number = 24): number {
  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1000;
  let cleaned = 0;

  for (const [wihId, evidence] of wihEvidence) {
    if (now - evidence.capturedAt > maxAge) {
      wihEvidence.delete(wihId);
      cleaned++;
    }
  }

  return cleaned;
}
