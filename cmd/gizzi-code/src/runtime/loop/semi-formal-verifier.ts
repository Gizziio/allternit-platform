/**
 * Semi-Formal Verifier - Implementation of Meta's Agentic Code Reasoning
 * 
 * Based on: "Agentic Code Reasoning" by Ugare & Chandra (Meta, 2026)
 * arXiv:2603.01896
 * 
 * Key insight: Structured reasoning templates that require explicit evidence
 * for each claim can nearly halve error rates in code verification tasks.
 * 
 * This implements the "semi-formal reasoning" approach where the agent must:
 * 1. State explicit premises about what each patch modifies
 * 2. Trace execution for each test, showing exact code paths
 * 3. Provide a formal conclusion that follows from the evidence
 * 4. If claiming non-equivalence, provide a specific counterexample
 */

import { Log } from "@/shared/util/log";
import type { Plan } from "./planner";
import type { ExecutionReceipt } from "./executor";
import { generateObject, type ModelMessage } from "ai";
import { Provider } from "@/runtime/providers/provider";
import z from "zod/v4";
import type { LanguageModelV2 } from "@/runtime/providers/adapters/bundled";

// ============================================================================
// Types for Semi-Formal Verification
// ============================================================================

export interface SemiFormalVerificationResult {
  passed: boolean;
  reason?: string;
  nextAction: "stop" | "continue" | "replan" | "ask_user";
  certificate?: VerificationCertificate;
  metadata?: {
    stepsAnalyzed: number;
    premisesCount: number;
    tracesCount: number;
    confidence: "high" | "medium" | "low";
  };
}

export interface VerificationCertificate {
  version: "1.0";
  task: {
    type: "patch_equivalence" | "fault_localization" | "code_qa" | "general";
    description: string;
  };
  definitions: Definition[];
  premises: Premise[];
  executionTraces: ExecutionTrace[];
  edgeCases: EdgeCaseAnalysis[];
  conclusion: Conclusion;
  counterexample?: Counterexample;
}

export interface Definition {
  id: string;
  statement: string;
}

export interface Premise {
  id: string;
  statement: string;
  evidence: string;
  sourceLocation?: string;
}

export interface ExecutionTrace {
  id: string;
  testName?: string;
  scenario: string;
  codePath: CodeStep[];
  outcome: "pass" | "fail" | "unknown";
  reasoning: string;
}

export interface CodeStep {
  file: string;
  line: number;
  function?: string;
  behavior: string;
  dependsOn?: string[];
}

export interface EdgeCaseAnalysis {
  description: string;
  patch1Behavior: string;
  patch2Behavior?: string;
  testOutcomeSame: boolean;
  reasoning: string;
}

export interface Conclusion {
  statement: string;
  followsFrom: string[];
  answer: "YES" | "NO" | "UNCERTAIN";
}

export interface Counterexample {
  testName: string;
  patch1Outcome: string;
  patch2Outcome: string;
  reasoning: string;
}

// ============================================================================
// Zod Schemas for Structured Generation
// ============================================================================

const CodeStepSchema = z.object({
  file: z.string(),
  line: z.number(),
  function: z.string().optional(),
  behavior: z.string(),
  dependsOn: z.array(z.string()).optional(),
});

const ExecutionTraceSchema = z.object({
  id: z.string(),
  testName: z.string().optional(),
  scenario: z.string(),
  codePath: z.array(CodeStepSchema),
  outcome: z.enum(["pass", "fail", "unknown"]),
  reasoning: z.string(),
});

const PremiseSchema = z.object({
  id: z.string(),
  statement: z.string(),
  evidence: z.string(),
  sourceLocation: z.string().optional(),
});

const EdgeCaseSchema = z.object({
  description: z.string(),
  patch1Behavior: z.string(),
  patch2Behavior: z.string().optional(),
  testOutcomeSame: z.boolean(),
  reasoning: z.string(),
});

const ConclusionSchema = z.object({
  statement: z.string(),
  followsFrom: z.array(z.string()),
  answer: z.enum(["YES", "NO", "UNCERTAIN"]),
});

const CounterexampleSchema = z.object({
  testName: z.string(),
  patch1Outcome: z.string(),
  patch2Outcome: z.string(),
  reasoning: z.string(),
});

export const VerificationCertificateSchema = z.object({
  version: z.literal("1.0"),
  task: z.object({
    type: z.enum(["patch_equivalence", "fault_localization", "code_qa", "general"]),
    description: z.string(),
  }),
  definitions: z.array(z.object({
    id: z.string(),
    statement: z.string(),
  })),
  premises: z.array(PremiseSchema),
  executionTraces: z.array(ExecutionTraceSchema),
  edgeCases: z.array(EdgeCaseSchema),
  conclusion: ConclusionSchema,
  counterexample: CounterexampleSchema.optional(),
});

// ============================================================================
// Prompt Template
// ============================================================================

const SEMI_FORMAL_VERIFICATION_PROMPT = `You are a code verification engine using semi-formal reasoning.

Your task is to verify code changes by constructing a formal certificate that proves your conclusion with explicit evidence. You cannot skip sections or make unsupported claims.

## Verification Task

Analyze the following execution context and determine if the changes are correct.

## Structured Certificate Template

You MUST fill in the following template completely:

---

### DEFINITIONS

State any key definitions needed for the proof:
- D1: [Definition 1 - e.g., what constitutes correctness for this task]
- D2: [Definition 2 - e.g., what the tests verify]

### PREMISES

State explicit premises about the code and changes:
- P1: [What files were modified and how - cite specific line numbers]
- P2: [What the original code did - cite evidence from file reads]
- P3: [What the new code does - trace the actual execution path]
- P4: [What the tests check - analyze test file contents]

Each premise MUST include:
- A clear statement of fact
- Evidence backing that fact (file:line references)
- How you verified this (what you read/searched)

### EXECUTION TRACES

For each relevant test or scenario, provide a complete execution trace:

Trace 1: [Test name or scenario]
- Starting point: [Entry function/file]
- Step 1: [file:line] - [Function name] - [What happens here]
- Step 2: [file:line] - [Function name] - [What happens here]
- ... continue until test outcome
- Outcome: [PASS/FAIL/UNKNOWN]
- Reasoning: [Why this outcome occurs]

Trace 2: [If comparing two patches, trace the same scenario through Patch 2]
- ... (same structure)

Important: Actually trace through the code. Don't assume function behavior - follow calls and verify what each function does at the specific line numbers in the actual files.

### EDGE CASES

Analyze edge cases that tests exercise:
- E1: [Edge case description]
  - Behavior with current code: [Specific output/behavior]
  - Test outcome: [PASS/FAIL]
  - Reasoning: [Why this occurs]

### CONCLUSION

Formal conclusion structure:
- Statement: [Clear statement of verification result]
- Follows from: [List premise IDs this conclusion depends on]
- Answer: [YES/NO/UNCERTAIN]

### COUNTEREXAMPLE (if claiming failure)

If the verification fails, provide a specific counterexample:
- Test: [Which test demonstrates the failure]
- Expected: [What should happen]
- Actual: [What actually happens]
- Location: [file:line where failure occurs]

---

## Rules

1. NO SKIPPING: You cannot skip any section. Every claim must have evidence.
2. NO ASSUMPTIONS: Don't assume what a function does - trace it to its definition.
3. CITE EVIDENCE: Every premise must cite file:line locations you actually examined.
4. BE COMPLETE: If you claim two patches are equivalent, you must trace ALL relevant code paths.
5. ADMIT UNCERTAINTY: If you cannot verify something, mark it as UNKNOWN rather than guessing.

## Failure Modes to Avoid

- Incomplete execution tracing: Don't assume function behavior without tracing
- Name shadowing: Check what functions actually refer to (e.g., format() might not be builtin)
- Third-party semantics: When source isn't available, note this as a limitation
- Dismissing subtle differences: If you find a semantic difference, analyze if it affects tests

Remember: The certificate acts as proof. It should be detailed enough that another engineer could verify your conclusion by following your traces.`;

// ============================================================================
// Semi-Formal Verifier Class
// ============================================================================

export class SemiFormalVerifier {
  private log = Log.create({ service: "runtime.semi-formal-verifier" });
  private sessionId: string;
  private options: {
    maxSteps?: number;
    confidenceThreshold?: number;
    model?: { providerID: string; modelID: string };
  };

  constructor(
    sessionId: string,
    options: {
      maxSteps?: number;
      confidenceThreshold?: number;
      model?: { providerID: string; modelID: string };
    } = {}
  ) {
    this.sessionId = sessionId;
    this.options = options;
  }

  /**
   * Perform semi-formal verification of execution results
   * 
   * This method implements the core semi-formal reasoning workflow:
   * 1. Gather context from execution receipts
   * 2. Generate structured certificate via LLM
   * 3. Validate certificate completeness
   * 4. Determine verification result
   */
  async verify(
    plan: Plan,
    receipts: ExecutionReceipt[],
    context?: {
      patches?: Array<{ path: string; content: string }>;
      testFiles?: string[];
      description?: string;
    }
  ): Promise<SemiFormalVerificationResult> {
    this.log.info("Starting semi-formal verification", {
      sessionId: this.sessionId,
      receiptCount: receipts.length,
      hasPatches: !!context?.patches?.length,
    });

    try {
      // Step 1: Build verification context
      const verificationContext = this.buildVerificationContext(plan, receipts, context);

      // Step 2: Generate structured certificate
      const certificate = await this.generateCertificate(verificationContext);

      // Step 3: Validate certificate
      const validation = this.validateCertificate(certificate);

      // Step 4: Determine result based on certificate
      const result = this.determineResult(certificate, validation, receipts);

      this.log.info("Semi-formal verification complete", {
        passed: result.passed,
        confidence: result.metadata?.confidence,
        premises: result.metadata?.premisesCount,
        traces: result.metadata?.tracesCount,
      });

      return result;
    } catch (error) {
      this.log.error("Semi-formal verification failed", { error });
      
      // Fall back to basic verification on error
      return {
        passed: false,
        reason: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
        nextAction: "ask_user",
      };
    }
  }

  /**
   * Build the context for verification
   */
  private buildVerificationContext(
    plan: Plan,
    receipts: ExecutionReceipt[],
    context?: {
      patches?: Array<{ path: string; content: string }>;
      testFiles?: string[];
      description?: string;
    }
  ): string {
    const parts: string[] = [];

    // Add task description
    parts.push("## Task Description");
    parts.push(context?.description || "Verify code changes are correct");
    parts.push("");

    // Add plan information
    parts.push("## Plan");
    parts.push(`Steps: ${plan.steps.length}`);
    for (const step of plan.steps) {
      parts.push(`- ${step.id}: ${step.toolId} ${JSON.stringify(step.args)}`);
    }
    parts.push("");

    // Add execution receipts
    parts.push("## Execution Results");
    for (const receipt of receipts) {
      const status = receipt.success ? "✓" : "✗";
      parts.push(`${status} ${receipt.stepId}: ${receipt.output}`);
      if (receipt.metadata?.exitCode !== undefined) {
        parts.push(`  Exit code: ${receipt.metadata.exitCode}`);
      }
    }
    parts.push("");

    // Add patch information if available
    if (context?.patches?.length) {
      parts.push("## Code Changes");
      for (const patch of context.patches) {
        parts.push(`### ${patch.path}`);
        parts.push("```");
        parts.push(patch.content);
        parts.push("```");
        parts.push("");
      }
    }

    // Add test file information
    if (context?.testFiles?.length) {
      parts.push("## Test Files");
      for (const testFile of context.testFiles) {
        parts.push(`- ${testFile}`);
      }
      parts.push("");
    }

    return parts.join("\n");
  }

  /**
   * Generate verification certificate using structured LLM generation
   */
  private async generateCertificate(
    context: string
  ): Promise<VerificationCertificate> {
    const defaultModel = await Provider.defaultModelConcrete();
    const modelDef = this.options.model ?? defaultModel;
    const modelInfo = await Provider.getModel(modelDef.providerID, modelDef.modelID);
    const language = await Provider.getLanguage(modelInfo) as LanguageModelV2;

    const messages: ModelMessage[] = [
      {
        role: "system",
        content: SEMI_FORMAL_VERIFICATION_PROMPT,
      },
      {
        role: "user",
        content: `${context}\n\nGenerate a complete verification certificate following the template above.`,
      },
    ];

    const result = await generateObject({
      model: language,
      messages,
      schema: VerificationCertificateSchema,
      experimental_telemetry: {
        isEnabled: false,
      },
    });

    return result.object as VerificationCertificate;
  }

  /**
   * Validate that the certificate is complete and well-formed
   */
  private validateCertificate(
    certificate: VerificationCertificate
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for empty premises
    if (certificate.premises.length === 0) {
      issues.push("No premises provided");
    }

    // Check for empty execution traces
    if (certificate.executionTraces.length === 0) {
      issues.push("No execution traces provided");
    }

    // Check for evidence in premises
    for (const premise of certificate.premises) {
      if (!premise.evidence || premise.evidence.length < 10) {
        issues.push(`Premise ${premise.id} lacks sufficient evidence`);
      }
    }

    // Check for code paths in traces
    for (const trace of certificate.executionTraces) {
      if (trace.codePath.length === 0) {
        issues.push(`Trace ${trace.id} has no code path steps`);
      }
    }

    // Check conclusion consistency
    if (certificate.conclusion.answer === "NO" && !certificate.counterexample) {
      issues.push("Negative conclusion without counterexample");
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Determine the final verification result from the certificate
   */
  private determineResult(
    certificate: VerificationCertificate,
    validation: { valid: boolean; issues: string[] },
    receipts: ExecutionReceipt[]
  ): SemiFormalVerificationResult {
    // Check for fatal failures in receipts
    const fatalFailure = receipts.find((r) => !r.success);
    if (fatalFailure) {
      return {
        passed: false,
        reason: `Execution failure: ${fatalFailure.output}`,
        nextAction: "replan",
        certificate,
        metadata: {
          stepsAnalyzed: receipts.length,
          premisesCount: certificate.premises.length,
          tracesCount: certificate.executionTraces.length,
          confidence: "high",
        },
      };
    }

    // Determine confidence based on validation and certificate quality
    let confidence: "high" | "medium" | "low" = "medium";
    
    if (validation.valid && certificate.premises.length >= 3 && certificate.executionTraces.length >= 2) {
      confidence = "high";
    } else if (validation.issues.length > 2 || certificate.premises.length < 2) {
      confidence = "low";
    }

    // Map certificate answer to result
    switch (certificate.conclusion.answer) {
      case "YES":
        return {
          passed: true,
          reason: certificate.conclusion.statement,
          nextAction: "stop",
          certificate,
          metadata: {
            stepsAnalyzed: receipts.length,
            premisesCount: certificate.premises.length,
            tracesCount: certificate.executionTraces.length,
            confidence,
          },
        };

      case "NO":
        return {
          passed: false,
          reason: certificate.counterexample 
            ? `${certificate.conclusion.statement}. Counterexample: ${certificate.counterexample.testName} - ${certificate.counterexample.reasoning}`
            : certificate.conclusion.statement,
          nextAction: confidence === "high" ? "replan" : "ask_user",
          certificate,
          metadata: {
            stepsAnalyzed: receipts.length,
            premisesCount: certificate.premises.length,
            tracesCount: certificate.executionTraces.length,
            confidence,
          },
        };

      case "UNCERTAIN":
        return {
          passed: false,
          reason: `Uncertain verification: ${certificate.conclusion.statement}`,
          nextAction: "ask_user",
          certificate,
          metadata: {
            stepsAnalyzed: receipts.length,
            premisesCount: certificate.premises.length,
            tracesCount: certificate.executionTraces.length,
            confidence: "low",
          },
        };
    }
  }

  /**
   * Compare two patches for equivalence using semi-formal reasoning
   * 
   * This is the core use case from the Meta paper - determining if two patches
   * produce the same test outcomes without executing them.
   */
  async verifyPatchEquivalence(
    patch1: { path: string; diff: string; description: string },
    patch2: { path: string; diff: string; description: string },
    testContext: {
      testPatch?: string;
      repositoryContext: string;
      relevantTests: string[];
    }
  ): Promise<SemiFormalVerificationResult> {
    this.log.info("Verifying patch equivalence", {
      patch1Path: patch1.path,
      patch2Path: patch2.path,
      testCount: testContext.relevantTests.length,
    });

    const context = `
## Patch Equivalence Verification Task

Determine if these two patches produce identical test outcomes.

### Definition
Two patches are EQUIVALENT MODULO TESTS iff executing the repository test suite produces identical pass/fail outcomes for both patches.

### Patch 1
**File:** ${patch1.path}
**Description:** ${patch1.description}
**Changes:**
\`\`\`diff
${patch1.diff}
\`\`\`

### Patch 2
**File:** ${patch2.path}
**Description:** ${patch2.description}
**Changes:**
\`\`\`diff
${patch2.diff}
\`\`\`

### Repository Context
${testContext.repositoryContext}

### Relevant Tests
${testContext.relevantTests.map(t => `- ${t}`).join("\n")}

${testContext.testPatch ? `### Test Patch\n\`\`\`diff\n${testContext.testPatch}\n\`\`\`` : ""}

IMPORTANT: Trace through the actual code paths. Do not assume function behavior.
Check what each function actually does at the specific line numbers.
Watch for name shadowing (e.g., format() might be a module function, not builtin).
`;

    try {
      const certificate = await this.generateCertificate(context);
      const validation = this.validateCertificate(certificate);
      
      // For patch equivalence, we need to be extra strict
      const isEquivalent = certificate.conclusion.answer === "YES";
      
      return {
        passed: isEquivalent,
        reason: certificate.conclusion.statement,
        nextAction: isEquivalent ? "stop" : "replan",
        certificate,
        metadata: {
          stepsAnalyzed: certificate.executionTraces.length,
          premisesCount: certificate.premises.length,
          tracesCount: certificate.executionTraces.length,
          confidence: validation.valid ? "high" : "medium",
        },
      };
    } catch (error) {
      this.log.error("Patch equivalence verification failed", { error });
      return {
        passed: false,
        reason: `Verification failed: ${error instanceof Error ? error.message : String(error)}`,
        nextAction: "ask_user",
      };
    }
  }
}

// ============================================================================
// Factory and Utilities
// ============================================================================

export function createSemiFormalVerifier(
  sessionId: string,
  options?: ConstructorParameters<typeof SemiFormalVerifier>[1]
): SemiFormalVerifier {
  return new SemiFormalVerifier(sessionId, options);
}

/**
 * Utility to format a certificate for display/logging
 */
export function formatCertificate(certificate: VerificationCertificate): string {
  const lines: string[] = [];
  
  lines.push("=".repeat(60));
  lines.push("VERIFICATION CERTIFICATE");
  lines.push("=".repeat(60));
  lines.push("");
  
  lines.push(`Task: ${certificate.task.description}`);
  lines.push(`Type: ${certificate.task.type}`);
  lines.push("");
  
  lines.push("DEFINITIONS:");
  for (const def of certificate.definitions) {
    lines.push(`  ${def.id}: ${def.statement}`);
  }
  lines.push("");
  
  lines.push("PREMISES:");
  for (const premise of certificate.premises) {
    lines.push(`  ${premise.id}: ${premise.statement}`);
    lines.push(`    Evidence: ${premise.evidence}`);
    if (premise.sourceLocation) {
      lines.push(`    Location: ${premise.sourceLocation}`);
    }
  }
  lines.push("");
  
  lines.push("EXECUTION TRACES:");
  for (const trace of certificate.executionTraces) {
    lines.push(`  ${trace.id}: ${trace.scenario}`);
    if (trace.testName) lines.push(`    Test: ${trace.testName}`);
    lines.push(`    Outcome: ${trace.outcome}`);
    for (const step of trace.codePath) {
      lines.push(`      ${step.file}:${step.line} - ${step.function || "anonymous"}`);
      lines.push(`        → ${step.behavior}`);
    }
  }
  lines.push("");
  
  lines.push("CONCLUSION:");
  lines.push(`  Statement: ${certificate.conclusion.statement}`);
  lines.push(`  Answer: ${certificate.conclusion.answer}`);
  lines.push(`  Based on: ${certificate.conclusion.followsFrom.join(", ")}`);
  
  if (certificate.counterexample) {
    lines.push("");
    lines.push("COUNTEREXAMPLE:");
    lines.push(`  Test: ${certificate.counterexample.testName}`);
    lines.push(`  Patch 1: ${certificate.counterexample.patch1Outcome}`);
    lines.push(`  Patch 2: ${certificate.counterexample.patch2Outcome}`);
  }
  
  lines.push("");
  lines.push("=".repeat(60));
  
  return lines.join("\n");
}
