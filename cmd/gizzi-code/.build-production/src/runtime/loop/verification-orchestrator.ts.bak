/**
 * Verification Orchestrator
 * 
 * Coordinates between standard verification (empirical) and semi-formal verification
 * (reasoning-based) as described in Meta's Agentic Code Reasoning paper.
 * 
 * Strategy:
 * - Use semi-formal verification for execution-free validation (faster, no sandbox needed)
 * - Fall back to empirical verification when semi-formal is inconclusive
 * - Combine both for high-confidence verification of critical changes
 * - Automatically captures visual evidence (screenshots, coverage maps, etc.)
 */

import { Log } from "@/shared/util/log";
import type { Plan } from "./planner";
import type { ExecutionReceipt } from "./executor";
import { Verifier, type VerificationResult as StandardVerificationResult } from "./verifier";
import { 
  SemiFormalVerifier, 
  type SemiFormalVerificationResult,
  type VerificationCertificate,
  formatCertificate 
} from "./semi-formal-verifier";
import { VisualCaptureManager, type CaptureResult as VisualCaptureResult } from "@/runtime/verification/visual";

export interface OrchestratedVerificationResult {
  /** Whether verification passed */
  passed: boolean;
  
  /** Human-readable reason */
  reason: string;
  
  /** Next action recommendation */
  nextAction: "stop" | "continue" | "replan" | "ask_user";
  
  /** Which verification method(s) were used */
  methodsUsed: ("empirical" | "semi-formal")[];
  
  /** Detailed results from each method */
  empiricalResult?: StandardVerificationResult;
  semiFormalResult?: SemiFormalVerificationResult;
  
  /** Confidence level based on method agreement */
  confidence: "high" | "medium" | "low";
  
  /** Whether the methods agreed */
  consensus: boolean;
  
  /** Certificate if semi-formal was used */
  certificate?: VerificationCertificate;
  
  /** Formatted certificate for display */
  formattedCertificate?: string;
  
  /** Visual evidence captured during verification (screenshots, coverage maps, etc.) */
  visualEvidence?: {
    artifacts: Array<{
      id: string;
      type: string;
      description: string;
      verificationClaim: string;
      confidence: number;
      imagePath?: string;
    }>;
    summary: {
      totalArtifacts: number;
      typesCaptured: string[];
      hasVisualEvidence: boolean;
    };
    llmContext: string;
  };
}

export interface VerificationStrategy {
  /** Which verification mode to use */
  mode: "empirical" | "semi-formal" | "both" | "adaptive";
  
  /** Threshold for confidence (0-1) */
  confidenceThreshold?: number;
  
  /** Whether to fall back to empirical if semi-formal is inconclusive */
  fallbackOnUncertainty?: boolean;
  
  /** Model to use for semi-formal verification */
  model?: { providerID: string; modelID: string };
  
  /** Additional context for verification */
  context?: {
    patches?: Array<{ path: string; content: string }>;
    testFiles?: string[];
    description?: string;
  };
  
  /** Visual evidence capture options - defaults to enabled */
  visualCapture?: {
    enabled?: boolean;
    outputDir?: string;
    enabledTypes?: string[];
  };
}

export class VerificationOrchestrator {
  private log = Log.create({ service: "runtime.verification-orchestrator" });
  private empiricalVerifier: Verifier;
  private semiFormalVerifier: SemiFormalVerifier;
  private visualManager?: VisualCaptureManager;
  private visualResult?: VisualCaptureResult;
  private sessionId: string;
  private strategy: VerificationStrategy;

  constructor(
    sessionId: string,
    strategy: VerificationStrategy = { mode: "adaptive" }
  ) {
    this.sessionId = sessionId;
    this.strategy = strategy;
    this.empiricalVerifier = new Verifier(sessionId);
    this.semiFormalVerifier = new SemiFormalVerifier(sessionId, {
      model: strategy.model,
    });
    
    // Initialize visual capture - enabled by default
    const visualCaptureConfig = this.strategy.visualCapture ?? { enabled: true };
    if (visualCaptureConfig.enabled !== false) {
      this.visualManager = new VisualCaptureManager({
        outputDir: visualCaptureConfig.outputDir ?? "./.verification/visual",
        enabledTypes: (visualCaptureConfig.enabledTypes ?? ["ui-state", "coverage-map", "console-output"]) as any,
      });
    }
  }

  /**
   * Main verification entry point
   * 
   * Based on strategy, coordinates empirical and/or semi-formal verification
   * Automatically captures visual evidence for LLM reasoning
   */
  async verify(
    plan: Plan,
    receipts: ExecutionReceipt[],
    context?: VerificationStrategy["context"]
  ): Promise<OrchestratedVerificationResult> {
    this.log.info("Starting orchestrated verification", {
      sessionId: this.sessionId,
      mode: this.strategy.mode,
      steps: plan.steps.length,
      receipts: receipts.length,
    });

    // Run verification based on strategy
    let result: OrchestratedVerificationResult;
    switch (this.strategy.mode) {
      case "empirical":
        result = await this.runEmpiricalOnly(plan, receipts);
        break;
      
      case "semi-formal":
        result = await this.runSemiFormalOnly(plan, receipts);
        break;
      
      case "both":
        result = await this.runBoth(plan, receipts);
        break;
      
      case "adaptive":
      default:
        result = await this.runAdaptive(plan, receipts);
        break;
    }
    
    // Capture visual evidence
    await this.captureVisualEvidence(plan, receipts, result);
    
    return result;
  }
  
  /**
   * Capture visual evidence for verification
   * Automatically detects changed files and captures screenshots, coverage maps, etc.
   */
  private async captureVisualEvidence(
    plan: Plan,
    receipts: ExecutionReceipt[],
    result: OrchestratedVerificationResult
  ): Promise<void> {
    if (!this.visualManager) return;
    
    try {
      this.log.info("Capturing visual evidence");
      
      // Auto-detect files from git if not provided
      const files = this.strategy.context?.patches?.map(p => p.path) || 
                    this.detectChangedFiles() ||
                    [];
      
      const captureContext = {
        sessionId: this.sessionId,
        verificationId: `verify_${Date.now()}`,
        cwd: process.cwd(),
        files: files.length > 0 ? files : undefined,
        patches: this.strategy.context?.patches?.map(p => ({
          path: p.path,
          after: p.content || "",
        })),
        testFiles: this.strategy.context?.testFiles,
      };
      
      this.visualResult = await this.visualManager.capture(captureContext);
      
      // Attach visual evidence to result
      result.visualEvidence = {
        artifacts: this.visualResult.artifacts.map(a => ({
          id: a.id,
          type: a.type,
          description: a.description,
          verificationClaim: a.verificationClaim,
          confidence: a.confidence,
          imagePath: a.image?.path,
        })),
        summary: this.visualResult.summary,
        llmContext: this.visualManager.formatForLLM(this.visualResult),
      };
      
      this.log.info("Visual evidence captured", {
        artifactCount: this.visualResult.artifacts.length,
        types: this.visualResult.summary.typesCaptured,
      });
    } catch (error) {
      this.log.warn("Failed to capture visual evidence", { error });
      // Don't fail verification if visual capture fails
    }
  }
  
  /**
   * Auto-detect changed files from git
   */
  private detectChangedFiles(): string[] | null {
    try {
      const { execSync } = require("child_process");
      const output = execSync("git diff --name-only HEAD", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      const files = output.split("\n").filter(Boolean);
      return files.length > 0 ? files : null;
    } catch {
      return null;
    }
  }

  /**
   * Run only empirical verification (standard approach)
   */
  private async runEmpiricalOnly(
    plan: Plan,
    receipts: ExecutionReceipt[]
  ): Promise<OrchestratedVerificationResult> {
    this.log.debug("Running empirical verification only");
    
    const result = await this.empiricalVerifier.verify(plan, receipts);
    
    return {
      passed: result.passed,
      reason: result.reason || (result.passed ? "Empirical verification passed" : "Empirical verification failed"),
      nextAction: result.nextAction,
      methodsUsed: ["empirical"],
      empiricalResult: result,
      confidence: result.passed ? "high" : "medium",
      consensus: true,
    };
  }

  /**
   * Run only semi-formal verification (Meta's approach)
   */
  private async runSemiFormalOnly(
    plan: Plan,
    receipts: ExecutionReceipt[]
  ): Promise<OrchestratedVerificationResult> {
    this.log.debug("Running semi-formal verification only");
    
    const result = await this.semiFormalVerifier.verify(
      plan, 
      receipts, 
      this.strategy.context
    );

    const formattedCert = result.certificate 
      ? formatCertificate(result.certificate)
      : undefined;

    return {
      passed: result.passed,
      reason: result.reason || (result.passed ? "Semi-formal verification passed" : "Semi-formal verification failed"),
      nextAction: result.nextAction,
      methodsUsed: ["semi-formal"],
      semiFormalResult: result,
      confidence: result.metadata?.confidence || "medium",
      consensus: true,
      certificate: result.certificate,
      formattedCertificate: formattedCert,
    };
  }

  /**
   * Run both verification methods and compare results
   */
  private async runBoth(
    plan: Plan,
    receipts: ExecutionReceipt[]
  ): Promise<OrchestratedVerificationResult> {
    this.log.debug("Running both verification methods");

    // Run both in parallel
    const [empirical, semiFormal] = await Promise.all([
      this.empiricalVerifier.verify(plan, receipts),
      this.semiFormalVerifier.verify(plan, receipts, this.strategy.context),
    ]);

    // Determine consensus
    const consensus = empirical.passed === semiFormal.passed;
    
    // Calculate confidence based on agreement and individual confidences
    let confidence: "high" | "medium" | "low";
    if (consensus && empirical.passed) {
      confidence = "high";
    } else if (consensus && !empirical.passed) {
      confidence = "high";
    } else {
      confidence = "low";
    }

    // If they disagree, prefer empirical but flag for review
    const passed = empirical.passed;
    const reason = consensus
      ? `Both methods agree: ${empirical.reason || semiFormal.reason}`
      : `METHOD DISAGREEMENT - Empirical: ${empirical.passed}, Semi-formal: ${semiFormal.passed}. Empirical result: ${empirical.reason}`;

    const nextAction = consensus
      ? empirical.nextAction
      : "ask_user"; // Disagreement requires human review

    return {
      passed,
      reason,
      nextAction,
      methodsUsed: ["empirical", "semi-formal"],
      empiricalResult: empirical,
      semiFormalResult: semiFormal,
      confidence,
      consensus,
      certificate: semiFormal.certificate,
      formattedCertificate: semiFormal.certificate 
        ? formatCertificate(semiFormal.certificate)
        : undefined,
    };
  }

  /**
   * Adaptive strategy: use semi-formal first, fall back to empirical if needed
   * 
   * This is the recommended approach for production use:
   * 1. Try semi-formal (fast, no sandbox)
   * 2. If confident result, use it
   * 3. If uncertain, run empirical
   * 4. If methods disagree, flag for human review
   */
  private async runAdaptive(
    plan: Plan,
    receipts: ExecutionReceipt[]
  ): Promise<OrchestratedVerificationResult> {
    this.log.debug("Running adaptive verification");

    // First, try semi-formal
    const semiFormal = await this.semiFormalVerifier.verify(
      plan,
      receipts,
      this.strategy.context
    );

    const semiFormalConfidence = semiFormal.metadata?.confidence;

    // If semi-formal is high confidence, use it
    if (semiFormalConfidence === "high" && semiFormal.passed) {
      this.log.info("Semi-formal verification high confidence, using result");
      return {
        passed: semiFormal.passed,
        reason: semiFormal.reason || "High-confidence semi-formal verification passed",
        nextAction: semiFormal.nextAction,
        methodsUsed: ["semi-formal"],
        semiFormalResult: semiFormal,
        confidence: "high",
        consensus: true,
        certificate: semiFormal.certificate,
        formattedCertificate: semiFormal.certificate
          ? formatCertificate(semiFormal.certificate)
          : undefined,
      };
    }

    // If semi-formal is uncertain or failed with medium confidence, run empirical
    if (this.strategy.fallbackOnUncertainty !== false) {
      this.log.info("Semi-formal inconclusive, falling back to empirical", {
        semiFormalConfidence,
        semiFormalPassed: semiFormal.passed,
      });

      const empirical = await this.empiricalVerifier.verify(plan, receipts);

      // Check for consensus
      const consensus = empirical.passed === semiFormal.passed;
      
      return {
        passed: empirical.passed,
        reason: consensus
          ? (empirical.reason || semiFormal.reason || "Verification complete")
          : `Semi-formal (${semiFormal.passed}) and empirical (${empirical.passed}) disagree. Using empirical: ${empirical.reason || "no reason"}`,
        nextAction: consensus ? empirical.nextAction : "ask_user",
        methodsUsed: ["semi-formal", "empirical"],
        empiricalResult: empirical,
        semiFormalResult: semiFormal,
        confidence: consensus ? "high" : "low",
        consensus,
        certificate: semiFormal.certificate,
        formattedCertificate: semiFormal.certificate
          ? formatCertificate(semiFormal.certificate)
          : undefined,
      };
    }

    // Fallback disabled, return semi-formal result
    return {
      passed: semiFormal.passed,
      reason: semiFormal.reason || "Semi-formal verification result (fallback disabled)",
      nextAction: semiFormal.nextAction,
      methodsUsed: ["semi-formal"],
      semiFormalResult: semiFormal,
      confidence: semiFormalConfidence || "medium",
      consensus: true,
      certificate: semiFormal.certificate,
      formattedCertificate: semiFormal.certificate
        ? formatCertificate(semiFormal.certificate)
        : undefined,
    };
  }

  /**
   * Verify patch equivalence without execution
   * 
   * This is the key use case from the Meta paper - determining if two patches
   * produce the same test outcomes without running them.
   */
  async verifyPatchEquivalence(
    patch1: { path: string; diff: string; description: string },
    patch2: { path: string; diff: string; description: string },
    testContext: {
      testPatch?: string;
      repositoryContext: string;
      relevantTests: string[];
    }
  ): Promise<OrchestratedVerificationResult> {
    this.log.info("Verifying patch equivalence via orchestrator", {
      patch1: patch1.path,
      patch2: patch2.path,
    });

    // Patch equivalence always uses semi-formal
    const result = await this.semiFormalVerifier.verifyPatchEquivalence(
      patch1,
      patch2,
      testContext
    );

    return {
      passed: result.passed,
      reason: result.reason || "Patch equivalence verification complete",
      nextAction: result.nextAction,
      methodsUsed: ["semi-formal"],
      semiFormalResult: result,
      confidence: result.metadata?.confidence || "medium",
      consensus: true,
      certificate: result.certificate,
      formattedCertificate: result.certificate
        ? formatCertificate(result.certificate)
        : undefined,
    };
  }

  /**
   * Update the verification strategy
   */
  setStrategy(strategy: Partial<VerificationStrategy>): void {
    this.strategy = { ...this.strategy, ...strategy };
    
    // Update semi-formal verifier if model changed
    if (strategy.model) {
      this.semiFormalVerifier = new SemiFormalVerifier(this.sessionId, {
        model: strategy.model,
      });
    }
  }

  /**
   * Get visual evidence from the last verification
   */
  getVisualEvidence(): VisualCaptureResult | undefined {
    return this.visualResult;
  }

  /**
   * Get visual evidence formatted for LLM prompting
   */
  getVisualEvidenceForLLM(): string | undefined {
    if (!this.visualResult) return undefined;
    return this.visualManager?.formatForLLM(this.visualResult);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createVerificationOrchestrator(
  sessionId: string,
  strategy?: VerificationStrategy
): VerificationOrchestrator {
  return new VerificationOrchestrator(sessionId, strategy);
}

/**
 * Quick verification using adaptive strategy (recommended default)
 */
export async function verifyWithAdaptiveStrategy(
  sessionId: string,
  plan: Plan,
  receipts: ExecutionReceipt[],
  context?: VerificationStrategy["context"]
): Promise<OrchestratedVerificationResult> {
  const orchestrator = createVerificationOrchestrator(sessionId, {
    mode: "adaptive",
    fallbackOnUncertainty: true,
    context,
  });
  return orchestrator.verify(plan, receipts);
}

/**
 * Execution-free verification using semi-formal reasoning only
 */
export async function verifyWithoutExecution(
  sessionId: string,
  plan: Plan,
  receipts: ExecutionReceipt[],
  context?: VerificationStrategy["context"]
): Promise<OrchestratedVerificationResult> {
  const orchestrator = createVerificationOrchestrator(sessionId, {
    mode: "semi-formal",
    context,
  });
  return orchestrator.verify(plan, receipts);
}
