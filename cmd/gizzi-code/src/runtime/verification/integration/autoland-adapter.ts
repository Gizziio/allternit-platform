/**
 * Visual Evidence + A2R Autoland Integration
 * 
 * Integrates the visual evidence capture system with the existing A2R Autoland
 * protocol (Rust-based gate system in 0-substrate).
 * 
 * This adapter adds visual verification as a pre-condition before the autoland
 * gate allows changes to be landed from `.a2r/runner/{wih_id}/` to project root.
 * 
 * Features:
 * - Dual-mode support: File-based (dev) and gRPC (production)
 * - Automatic mode selection
 * - Governance-compliant evidence gathering
 * - Audit trail preservation
 */

import { Log } from "@/shared/util/log";
import { Bus } from "@/shared/bus";
import type { VisualCaptureManager } from "../visual/manager";
import { 
  VerificationService, 
  initializeVerificationService,
  type EvidenceFile,
} from "../verification-service";
import { EvidenceFileWriter } from "../file-writer";

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
  /** Service mode: "auto" | "file" | "grpc" */
  mode: "auto" | "file" | "grpc";
  /** Timeout for evidence gathering (seconds) */
  timeoutSeconds: number;
}

export interface WihVisualEvidence {
  wihId: string;
  sessionId?: string;
  capturedAt: number;
  evidence: EvidenceFile;
  passed: boolean;
  confidence: number;
}

// ============================================================================
// Configuration
// ============================================================================

let visualManager: VisualCaptureManager | undefined;

const config: VisualAutolandConfig = {
  enabled: true,
  minConfidence: 0.7,
  requireForUIChanges: true,
  requiredTypes: ["console-output", "coverage-map"],
  mode: "auto",
  timeoutSeconds: 60,
};

// Store visual evidence by WIH ID
const wihEvidence = new Map<string, WihVisualEvidence>();

// Global verification service
let verificationService: VerificationService | null = null;

// ============================================================================
// Configuration Functions
// ============================================================================

export function configureVisualAutoland(options: Partial<VisualAutolandConfig>): void {
  Object.assign(config, options);
  log.info("[AutolandAdapter] Configuration updated", config);
}

export function setVisualManagerForAutoland(manager: VisualCaptureManager): void {
  visualManager = manager;
}

export function getVisualAutolandConfig(): VisualAutolandConfig {
  return { ...config };
}

// ============================================================================
// Initialization
// ============================================================================

export async function initializeVisualAutoland(): Promise<void> {
  if (!visualManager) {
    throw new Error("Visual manager not set. Call setVisualManagerForAutoland() first.");
  }

  if (!config.enabled) {
    log.info("[AutolandAdapter] Visual autoland disabled");
    return;
  }

  log.info("[AutolandAdapter] Initializing", { mode: config.mode });

  // Initialize verification service
  verificationService = await initializeVerificationService(visualManager, {
    mode: config.mode,
    fallbackToFile: true,
    autoCleanup: true,
    cleanupMaxAgeHours: 24,
  });

  const status = verificationService.getStatus();
  log.info("[AutolandAdapter] Verification service ready", status);
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
  if (!config.enabled) {
    log.debug("[AutolandAdapter] Disabled, skipping capture");
    return null;
  }

  if (!verificationService) {
    log.warn("[AutolandAdapter] Not initialized, attempting auto-init");
    if (visualManager) {
      await initializeVisualAutoland();
    } else {
      throw new Error("Cannot capture: visual manager not set");
    }
  }

  log.info("[AutolandAdapter] Capturing evidence", { wihId, mode: config.mode });

  try {
    // Use verification service to capture
    const evidence = await verificationService!.captureForWih(wihId, {
      changedFiles: options.changedFiles,
      timeout: options.timeout || config.timeoutSeconds * 1000,
    });

    // In gRPC mode, evidence is null (delivered to Rust directly)
    // In file mode, we get the evidence object
    if (!evidence && config.mode !== "grpc") {
      log.warn("[AutolandAdapter] No evidence captured", { wihId });
      return null;
    }

    // For file mode, process the evidence
    let evidenceData: EvidenceFile;
    if (evidence) {
      evidenceData = evidence;
    } else {
      // gRPC mode: read from backup file
      const backupEvidence = await verificationService!.readEvidence(wihId);
      if (!backupEvidence) {
        log.warn("[AutolandAdapter] No backup evidence found", { wihId });
        return null;
      }
      evidenceData = backupEvidence;
    }

    // Calculate if evidence passes requirements
    const passed = checkEvidencePasses(evidenceData);
    const confidence = evidenceData.overall_confidence;

    const wihEvidenceData: WihVisualEvidence = {
      wihId,
      sessionId: options.sessionId,
      capturedAt: Date.now(),
      evidence: evidenceData,
      passed,
      confidence,
    };

    wihEvidence.set(wihId, wihEvidenceData);

    log.info("[AutolandAdapter] Evidence captured", {
      wihId,
      passed,
      confidence,
      artifactCount: evidenceData.artifacts.length,
      mode: config.mode,
    });

    return wihEvidenceData;

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("[AutolandAdapter] Capture failed", { wihId, error: message });
    return null;
  }
}

/**
 * Check if evidence passes the configured requirements
 */
function checkEvidencePasses(evidence: EvidenceFile): boolean {
  // Check success flag
  if (!evidence.success) {
    return false;
  }

  // Check confidence threshold
  if (evidence.overall_confidence < config.minConfidence) {
    return false;
  }

  // Check required types
  const presentTypes = new Set(evidence.artifacts.map(a => a.type));
  for (const required of config.requiredTypes) {
    if (!presentTypes.has(required)) {
      return false;
    }
  }

  return true;
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
    return {
      allowed: false,
      reason: "Visual evidence not yet captured for WIH",
    };
  }

  if (!evidence.passed) {
    const missingTypes = config.requiredTypes.filter(type =>
      !evidence.evidence.artifacts.some(a => a.type === type)
    );
    
    let reason = `Visual verification failed: ${(evidence.confidence * 100).toFixed(1)}% confidence below ${(config.minConfidence * 100).toFixed(0)}% threshold`;
    
    if (missingTypes.length > 0) {
      reason += `. Missing: ${missingTypes.join(", ")}`;
    }

    return {
      allowed: false,
      reason,
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
  lines.push(`Mode: ${config.mode}`);
  lines.push(`Artifacts: ${evidence.evidence.artifacts.length}`);
  
  if (evidence.evidence.errors.length > 0) {
    lines.push("\nErrors:");
    for (const error of evidence.evidence.errors) {
      lines.push(`  - ${error}`);
    }
  }

  lines.push("\nArtifact Summary:");
  for (const artifact of evidence.evidence.artifacts) {
    const confidence = Math.round((artifact.confidence || 0) * 100);
    const desc = artifact.description?.substring(0, 50) || artifact.type;
    lines.push(`  [${artifact.type}] ${desc}... (${confidence}%)`);
  }

  return lines.join("\n");
}

// ============================================================================
// Autoland Gate Hooks
// ============================================================================

/**
 * Pre-land hook for the autoland gate
 * Returns whether landing should be allowed
 * 
 * This is the main entry point for Rust to check visual verification.
 */
export async function preLandHook(wihId: string): Promise<{
  allowed: boolean;
  reason?: string;
  confidence?: number;
}> {
  if (!config.enabled) {
    return { allowed: true };
  }

  // Check if we already have evidence
  let evidence = wihEvidence.get(wihId);

  // If not, try to capture now (for file-based mode)
  if (!evidence && verificationService && config.mode !== "grpc") {
    log.info("[AutolandAdapter] Auto-capturing evidence for pre-land", { wihId });
    const captured = await captureForWih(wihId);
    if (captured) {
      evidence = captured;
    }
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
      confidence: evidence.confidence,
    };
  }

  return { 
    allowed: true,
    confidence: evidence.confidence,
  };
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
    log.info("[AutolandAdapter] WIH landed with visual verification", {
      wihId,
      commitSha: result.commitSha,
      confidence: evidence.confidence,
      mode: config.mode,
    });
  }

  // Clean up evidence after landing (configurable)
  // wihEvidence.delete(wihId);
}

// ============================================================================
// Event Integration
// ============================================================================

/**
 * Handle WIH closed event
 * Automatically triggers visual capture when WIH closes with PASS
 */
export async function onWihClosed(
  wihId: string,
  status: "PASS" | "FAIL",
  options: {
    changedFiles?: string[];
  } = {},
): Promise<void> {
  if (!config.enabled) {
    return;
  }

  if (status !== "PASS") {
    log.debug("[AutolandAdapter] WIH not passed, skipping capture", { wihId, status });
    return;
  }

  log.info("[AutolandAdapter] WIH closed with PASS, capturing evidence", { wihId });

  await captureForWih(wihId, {
    changedFiles: options.changedFiles,
  });
}

// ============================================================================
// Cleanup
// ============================================================================

export function cleanupVisualAutoland(maxAgeHours: number = 24): number {
  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1000;
  let cleared = 0;

  for (const [wihId, evidence] of wihEvidence) {
    if (now - evidence.capturedAt > maxAge) {
      wihEvidence.delete(wihId);
      cleared++;
    }
  }

  log.info("[AutolandAdapter] Cleaned up old evidence", { cleared });
  return cleared;
}

// ============================================================================
// Status
// ============================================================================

export function getAdapterStatus(): {
  enabled: boolean;
  initialized: boolean;
  mode: string;
  config: VisualAutolandConfig;
  evidenceCount: number;
  serviceStatus?: ReturnType<VerificationService["getStatus"]>;
} {
  return {
    enabled: config.enabled,
    initialized: verificationService !== null,
    mode: config.mode,
    config: { ...config },
    evidenceCount: wihEvidence.size,
    serviceStatus: verificationService?.getStatus(),
  };
}
