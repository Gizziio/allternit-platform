/**
 * Semi-Formal Verifier
 * 
 * Implementation of Meta's Agentic Code Reasoning approach.
 * Uses structured certificates requiring explicit evidence for every claim.
 * 
 * Based on: "Agentic Code Reasoning" by Ugare & Chandra (Meta, 2026)
 * arXiv:2603.01896
 */

import { generateObject, type ModelMessage } from "ai";
import { Provider } from "@/runtime/providers/provider";
import { Log } from "@/shared/util/log";
import { randomUUID } from "crypto";

import type { Plan } from "@/runtime/loop/planner";
import type { ExecutionReceipt } from "@/runtime/loop/executor";
import type {
  VerificationStrategy,
  VerificationContext,
  SemiFormalVerificationResult,
  PatchEquivalenceRequest,
  FaultLocalizationRequest,
  FaultLocalizationResult,
  VerificationCertificate,
  VerificationTask,
  CertificateValidationResult,
  VerificationConfidence,
  VisualEvidence,
} from "../types";
import type { VisualArtifact } from "../visual/types";

import { BaseVerifier, VerificationTimeoutError } from "./base";
import { CertificateValidator } from "./certificate-validator";
import { ConfidenceScorer } from "./confidence-scorer";
import { PromptTemplateManager } from "../prompts/template-manager";

// ============================================================================
// Main Semi-Formal Verifier Class
// ============================================================================

export class SemiFormalVerifier extends BaseVerifier<SemiFormalVerificationResult> {
  readonly type = "semi-formal";
  readonly version = "1.0.0";
  
  private certificateValidator: CertificateValidator;
  private confidenceScorer: ConfidenceScorer;
  private promptManager: PromptTemplateManager;
  private startTime: number = 0;
  
  constructor(
    id: string,
    private options: {
      model?: { providerId: string; modelId: string };
      timeoutMs?: number;
      maxRetries?: number;
    } = {}
  ) {
    super(id);
    this.certificateValidator = new CertificateValidator();
    this.confidenceScorer = new ConfidenceScorer();
    this.promptManager = new PromptTemplateManager();
    this.log = Log.create({ service: "verification.semi-formal" });
  }
  
  /**
   * Main verification entry point
   */
  async verify(
    plan: Plan,
    receipts: ExecutionReceipt[],
    context?: VerificationContext,
    visualArtifacts?: VisualArtifact[]
  ): Promise<SemiFormalVerificationResult> {
    this.startTime = Date.now();
    this.checkCancelled();
    
    this.log.info("Starting semi-formal verification", {
      verifierId: this.id,
      planSteps: plan.steps.length,
      receipts: receipts.length,
      visualArtifacts: visualArtifacts?.length || 0,
    });
    
    try {
      // Build verification task
      const task = await this.buildVerificationTask(plan, receipts, context);
      
      // Generate certificate with visual evidence
      const certificate = await this.generateCertificate(task, context, visualArtifacts);
      
      // Validate certificate
      const validation = await this.validateCertificate(certificate);
      
      // Calculate confidence
      const confidence = this.calculateConfidence(certificate, validation);
      
      // Determine result
      const passed = certificate.conclusion.answer === "YES";
      
      const durationMs = Date.now() - this.startTime;
      
      const result: SemiFormalVerificationResult = {
        passed,
        reason: certificate.conclusion.statement,
        nextAction: this.determineNextAction(passed, confidence.level, validation),
        certificate,
        confidence: {
          level: confidence.level,
          score: confidence.score,
          reasoning: confidence.reasoning,
        },
        certificateValidation: {
          valid: validation.valid,
          completeness: validation.completeness,
          errors: validation.errors.map(e => e.message),
          warnings: validation.warnings.map(w => w.message),
        },
        timing: {
          startedAt: new Date(this.startTime).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs,
        },
        reasoning: {
          premisesCount: certificate.premises.length,
          tracesCount: certificate.executionTraces.length,
          edgeCasesCount: certificate.edgeCases.length,
          alternativeHypothesesCount: certificate.alternativeHypotheses?.length || 0,
          avgEvidenceQuality: this.calculateAvgEvidenceQuality(certificate),
        },
      };
      
      this.log.info("Semi-formal verification complete", {
        verifierId: this.id,
        passed,
        confidence: confidence.level,
        durationMs,
      });
      
      return result;
    } catch (error) {
      this.log.error("Semi-formal verification failed", {
        verifierId: this.id,
        error,
      });
      throw error;
    }
  }
  
  /**
   * Verify patch equivalence (key use case from Meta paper)
   */
  async verifyPatchEquivalence(
    request: PatchEquivalenceRequest
  ): Promise<SemiFormalVerificationResult> {
    this.startTime = Date.now();
    this.checkCancelled();
    
    this.log.info("Starting patch equivalence verification", {
      verifierId: this.id,
      patch1: request.patch1.path,
      patch2: request.patch2.path,
    });
    
    try {
      // Build task for patch equivalence
      const task: VerificationTask = {
        type: "patch_equivalence",
        description: `Verify equivalence of patches to ${request.patch1.path}`,
        question: "Do these two patches produce identical test outcomes?",
        scope: {
          files: [request.patch1.path, request.patch2.path],
          tests: request.testContext.relevantTests,
          patches: [
            {
              id: "patch1",
              path: request.patch1.path,
              description: request.patch1.description,
              diff: request.patch1.diff,
            },
            {
              id: "patch2",
              path: request.patch2.path,
              description: request.patch2.description,
              diff: request.patch2.diff,
            },
          ],
        },
      };
      
      // Build rich context
      const context: VerificationContext = {
        description: request.patch1.description,
        patches: [request.patch1, request.patch2],
        testFiles: request.testContext.relevantTests,
        expectedBehavior: "Both patches should produce identical test outcomes",
      };
      
      // Generate certificate with patch equivalence template
      const certificate = await this.generateCertificate(task, context, undefined, "patch_equivalence");
      
      // Validate
      const validation = await this.validateCertificate(certificate);
      
      // Calculate confidence
      const confidence = this.calculateConfidence(certificate, validation);
      
      // For patch equivalence, passed means they ARE equivalent
      const passed = certificate.conclusion.answer === "YES";
      
      const durationMs = Date.now() - this.startTime;
      
      return {
        passed,
        reason: certificate.conclusion.statement,
        nextAction: this.determineNextAction(passed, confidence.level, validation),
        certificate,
        confidence: {
          level: confidence.level,
          score: confidence.score,
          reasoning: confidence.reasoning,
        },
        certificateValidation: {
          valid: validation.valid,
          completeness: validation.completeness,
          errors: validation.errors.map(e => e.message),
          warnings: validation.warnings.map(w => w.message),
        },
        timing: {
          startedAt: new Date(this.startTime).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs,
        },
        reasoning: {
          premisesCount: certificate.premises.length,
          tracesCount: certificate.executionTraces.length,
          edgeCasesCount: certificate.edgeCases.length,
          alternativeHypothesesCount: certificate.alternativeHypotheses?.length || 0,
          avgEvidenceQuality: this.calculateAvgEvidenceQuality(certificate),
        },
      };
    } catch (error) {
      this.log.error("Patch equivalence verification failed", { error });
      throw error;
    }
  }
  
  /**
   * Fault localization (another use case from Meta paper)
   */
  async localizeFault(
    request: FaultLocalizationRequest
  ): Promise<FaultLocalizationResult> {
    this.startTime = Date.now();
    this.checkCancelled();
    
    this.log.info("Starting fault localization", {
      verifierId: this.id,
      test: request.failingTest,
    });
    
    try {
      // Build task for fault localization
      const task: VerificationTask = {
        type: "fault_localization",
        description: `Identify the fault causing ${request.failingTest} to fail`,
        question: "Which lines of code contain the bug?",
        scope: {
          files: request.sourceFiles,
          tests: [request.failingTest],
        },
      };
      
      const context: VerificationContext = {
        description: `Fault localization for ${request.failingTest}`,
        repository: request.repository,
      };
      
      // Generate certificate with fault localization template
      const certificate = await this.generateCertificate(task, context, undefined, "fault_localization");
      
      // Extract suspicious locations from certificate
      const suspiciousLocations = this.extractSuspiciousLocations(certificate);
      
      return {
        success: true,
        suspiciousLocations,
        certificate,
      };
    } catch (error) {
      this.log.error("Fault localization failed", { error });
      throw error;
    }
  }
  
  /**
   * Check if strategy is supported
   */
  supportsStrategy(strategy: VerificationStrategy): boolean {
    return strategy.mode === "semi-formal" || strategy.mode === "adaptive";
  }
  
  // ========================================================================
  // Private Methods
  // ========================================================================
  
  /**
   * Build verification task from plan and receipts
   */
  private async buildVerificationTask(
    plan: Plan,
    receipts: ExecutionReceipt[],
    context?: VerificationContext
  ): Promise<VerificationTask> {
    this.updateProgress({ currentPhase: "building_task" });
    
    // Analyze receipts to understand what was done
    const executedTools = receipts.map(r => r.toolId);
    const failedSteps = receipts.filter(r => !r.success);
    
    // Determine task type
    let type: VerificationTask["type"] = "general";
    if (context?.patches && context.patches.length > 0) {
      type = "patch_equivalence";
    } else if (executedTools.includes("test")) {
      type = "code_qa";
    }
    
    return {
      type,
      description: context?.description || `Verification of ${plan.steps.length} steps`,
      scope: {
        files: context?.patches?.map(p => p.path),
        tests: context?.testFiles,
      },
    };
  }
  
  /**
   * Generate verification certificate using LLM
   */
  private async generateCertificate(
    task: VerificationTask,
    context?: VerificationContext,
    visualArtifacts?: VisualArtifact[],
    templateType: "general" | "patch_equivalence" | "fault_localization" | "code_qa" = "general"
  ): Promise<VerificationCertificate> {
    this.updateProgress({ currentPhase: "generating_certificate" });
    this.checkCancelled();
    
    // Get the prompt template
    const prompt = this.promptManager.getTemplate(templateType, {
      task,
      context,
    });
    
    // Get model
    const defaultModel = await Provider.defaultModelConcrete();
    const model = this.options.model || { providerId: defaultModel.providerID, modelId: defaultModel.modelID };
    const language = await Provider.getLanguage({ providerID: model.providerId, id: model.modelId } as any);
    
    // Import schema
    const { VerificationCertificateSchema } = await import("../schemas/certificate");
    
    // Generate with timeout
    const timeoutMs = this.options.timeoutMs || 60000;
    const startTime = Date.now();
    
    const generatePromise = generateObject({
      model: language,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: this.buildUserPrompt(task, context, visualArtifacts) },
      ],
      schema: VerificationCertificateSchema,
      temperature: 0.2, // Low temperature for more deterministic reasoning
      maxOutputTokens: 8000,
    });
    
    // Race against timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new VerificationTimeoutError(this.id, timeoutMs, "certificate_generation"));
      }, timeoutMs);
    });
    
    const result = await Promise.race([generatePromise, timeoutPromise]);
    
    // Enhance certificate with metadata
    const certificate = result.object as VerificationCertificate & { visualEvidence?: VisualEvidence[]; metadata?: any };
    certificate.id = `cert_${randomUUID()}`;
    certificate.timestamp = new Date().toISOString();
    certificate.metadata = {
      model: {
        provider: model.providerId,
        modelId: model.modelId,
      },
      parameters: {
        temperature: 0.2,
        maxOutputTokens: 8000,
      },
      timing: {
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      },
      toolVersions: {
        verifier: this.version,
        schema: "1.0",
      },
    };
    
    // Add visual evidence to certificate
    if (visualArtifacts && visualArtifacts.length > 0) {
      certificate.visualEvidence = this.convertVisualArtifacts(visualArtifacts);
    }
    
    return certificate;
  }
  
  /**
   * Build user prompt for certificate generation
   */
  private buildUserPrompt(
    task: VerificationTask,
    context?: VerificationContext,
    visualArtifacts?: VisualArtifact[]
  ): string {
    const lines: string[] = [];
    
    lines.push("# Verification Request");
    lines.push("");
    lines.push(`**Type:** ${task.type}`);
    lines.push(`**Description:** ${task.description}`);
    if (task.question) {
      lines.push(`**Question:** ${task.question}`);
    }
    lines.push("");
    
    if (context) {
      lines.push("## Context");
      if (context.description) {
        lines.push(context.description);
        lines.push("");
      }
      
      if (context.patches && context.patches.length > 0) {
        lines.push("### Patches");
        for (const patch of context.patches) {
          lines.push(`#### ${patch.path}`);
          lines.push(`Description: ${patch.description}`);
          lines.push("```diff");
          lines.push(patch.diff);
          lines.push("```");
          lines.push("");
        }
      }
      
      if (context.testFiles && context.testFiles.length > 0) {
        lines.push("### Test Files");
        for (const test of context.testFiles) {
          lines.push(`- ${test}`);
        }
        lines.push("");
      }
    }
    
    // Include visual evidence in prompt
    if (visualArtifacts && visualArtifacts.length > 0) {
      lines.push("## Visual Evidence");
      lines.push("");
      lines.push("The following visual artifacts provide evidence about the code:");
      lines.push("");
      
      for (const artifact of visualArtifacts) {
        lines.push(`### ${artifact.type}: ${artifact.description}`);
        lines.push(`**Claim:** ${artifact.verificationClaim}`);
        lines.push(`**Confidence:** ${(artifact.confidence * 100).toFixed(0)}%`);
        
        if (artifact.annotations.length > 0) {
          lines.push("**Key Observations:**");
          for (const ann of artifact.annotations) {
            const icon = ann.severity === "error" ? "❌" : 
                         ann.severity === "warning" ? "⚠️" : "ℹ️";
            lines.push(`- ${icon} **${ann.label}**: ${ann.note}`);
          }
        }
        
        lines.push("");
        lines.push("**Details:**");
        lines.push(artifact.llmContext.slice(0, 2000)); // Limit length
        lines.push("");
        
        if (artifact.image) {
          lines.push(`**Visual Reference:** Screenshot available at ${artifact.image.path}`);
          lines.push("");
        }
      }
      
      lines.push("---");
      lines.push("");
      lines.push("Use this visual evidence to inform your verification. ");
      lines.push("If screenshots show UI issues, mention them in your certificate. ");
      lines.push("If coverage is low, note what lines need testing.");
      lines.push("");
    }
    
    lines.push("---");
    lines.push("");
    lines.push("Generate a complete verification certificate following the structured template.");
    lines.push("Every claim must have evidence with file:line citations.");
    lines.push("Trace all function calls - do not assume behavior.");
    lines.push("Reference visual evidence where applicable.");
    
    return lines.join("\n");
  }
  
  /**
   * Convert visual artifacts to certificate visual evidence format
   */
  private convertVisualArtifacts(artifacts: VisualArtifact[]): VisualEvidence[] {
    return artifacts.map(artifact => ({
      id: artifact.id,
      type: artifact.type,
      description: artifact.description,
      verificationClaim: artifact.verificationClaim,
      imagePath: artifact.image?.path,
      imageFormat: artifact.image?.format,
      dimensions: artifact.image ? { width: artifact.image.width, height: artifact.image.height } : undefined,
      confidence: artifact.confidence,
      annotations: artifact.annotations.map(ann => ({
        label: ann.label,
        note: ann.note,
        severity: ann.severity,
      })),
      sourceRefs: artifact.sourceRefs,
      data: artifact.data,
    })) as VisualEvidence[];
  }
  
  /**
   * Validate the generated certificate
   */
  private async validateCertificate(
    certificate: VerificationCertificate
  ): Promise<CertificateValidationResult> {
    this.updateProgress({ currentPhase: "validating_certificate" });
    return this.certificateValidator.validate(certificate);
  }
  
  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    certificate: VerificationCertificate,
    validation: CertificateValidationResult
  ): { level: VerificationConfidence; score: number; reasoning: string } {
    this.updateProgress({ currentPhase: "calculating_confidence" });
    return this.confidenceScorer.calculate(certificate, validation);
  }
  
  /**
   * Calculate average evidence quality
   */
  private calculateAvgEvidenceQuality(certificate: VerificationCertificate): number {
    if (certificate.premises.length === 0) return 0;
    
    const scores = certificate.premises.map(p => {
      let score = 0;
      
      // Has source locations
      if (p.evidence.sourceLocations.length > 0) score += 0.3;
      
      // Has specific verification method
      if (p.evidence.verificationMethod !== "assumption") score += 0.3;
      
      // Has content
      if (p.evidence.content || p.evidence.sourceLocations.some(l => l.snippet)) score += 0.2;
      
      // Is proven (not inferred or assumed)
      if (p.certainty === "proven") score += 0.2;
      
      return score;
    });
    
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }
  
  /**
   * Determine next action based on result
   */
  private determineNextAction(
    passed: boolean,
    confidence: VerificationConfidence,
    validation: CertificateValidationResult
  ): "stop" | "continue" | "replan" | "ask_user" {
    if (passed && confidence === "high") {
      return "stop";
    }
    
    if (!passed && confidence === "high") {
      return "replan";
    }
    
    if (confidence === "low" || !validation.valid) {
      return "ask_user";
    }
    
    return "continue";
  }
  
  /**
   * Extract suspicious locations from fault localization certificate
   */
  private extractSuspiciousLocations(
    certificate: VerificationCertificate
  ): FaultLocalizationResult["suspiciousLocations"] {
    const locations: FaultLocalizationResult["suspiciousLocations"] = [];
    
    // Extract from premises
    for (const premise of certificate.premises) {
      for (const loc of premise.evidence.sourceLocations) {
        locations.push({
          rank: locations.length + 1,
          file: loc.file,
          line: loc.line,
          function: loc.context,
          score: premise.certainty === "proven" ? 0.9 : 0.7,
          reason: premise.statement,
        });
      }
    }
    
    // Extract from execution traces (especially failed traces)
    for (const trace of certificate.executionTraces) {
      if (trace.outcome.status === "fail" || trace.outcome.status === "error") {
        for (const step of trace.steps) {
          locations.push({
            rank: locations.length + 1,
            file: step.location.file,
            line: step.location.line,
            function: step.function?.name,
            score: 0.8,
            reason: `Failed in trace: ${trace.name}`,
          });
        }
      }
    }
    
    // Sort by score and re-rank
    locations.sort((a, b) => b.score - a.score);
    locations.forEach((loc, i) => { loc.rank = i + 1; });
    
    return locations.slice(0, 10); // Top 10
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSemiFormalVerifier(
  options?: ConstructorParameters<typeof SemiFormalVerifier>[1]
): SemiFormalVerifier {
  return new SemiFormalVerifier(`semi_formal_${randomUUID().slice(0, 8)}`, options);
}
