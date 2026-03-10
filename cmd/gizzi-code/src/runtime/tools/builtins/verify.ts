/**
 * Verify Tool - Semi-Formal Code Verification
 * 
 * Built-in tool for running Meta's Agentic Code Reasoning during agent execution.
 * 
 * USAGE EXAMPLES:
 * 
 * Basic adaptive verification:
 * ```
 * <tool>verify</tool>
 * <parameter>mode</parameter>
 * <parameter>adaptive</parameter>
 * <parameter>description</parameter>
 * <parameter>Verify auth fix handles null inputs</parameter>
 * ```
 * 
 * Semi-formal with patches:
 * ```
 * <tool>verify</tool>
 * <parameter>mode</parameter>
 * <parameter>semi-formal</parameter>
 * <parameter>description</parameter>
 * <parameter>Fix SQL injection in auth</parameter>
 * <parameter>patches</parameter>
 * <parameter>[{"path": "src/auth.ts", "description": "Added parameterized query"}]</parameter>
 * <parameter>confidence</parameter>
 * <parameter>high</parameter>
 * ```
 * 
 * Empirical with test files:
 * ```
 * <tool>verify</tool>
 * <parameter>mode</parameter>
 * <parameter>empirical</parameter>
 * <parameter>testFiles</parameter>
 * <parameter>["src/auth.test.ts", "src/user.test.ts"]</parameter>
 * ```
 * 
 * MODES:
 * - adaptive: Try semi-formal first, fallback to empirical (RECOMMENDED)
 * - semi-formal: Reasoning-based with structured certificates (fast, no sandbox)
 * - empirical: Test execution only (slower but definitive)
 * - both: Run both methods and compare (highest confidence)
 * 
 * Based on: "Agentic Code Reasoning" by Ugare & Chandra (Meta, 2026)
 * arXiv:2603.01896
 * Accuracy: 78% → 88-93%
 */

import z from "zod/v4"
import { Tool } from "@/runtime/tools/builtins/tool"
import { Log } from "@/shared/util/log"
import { 
  VerificationOrchestrator,
  type VerificationStrategy,
} from "@/runtime/loop/verification"
import { storeVerification } from "@/runtime/loop/verification/store"
import type { Plan, ExecutionReceipt } from "@/runtime/loop"

const log = Log.create({ service: "verify-tool" })

/**
 * Verify tool definition
 * 
 * Allows the agent to verify code changes using:
 * - semi-formal: Reasoning-based verification (structured certificates)
 * - empirical: Test-based verification
 * - both: Run both methods
 * - adaptive: Try semi-formal first, fallback to empirical
 */
export const VerifyTool = Tool.define("verify", async () => {
  return {
    description: `Verify code changes using semi-formal reasoning or test execution.

This tool uses Meta's Agentic Code Reasoning approach to verify code correctness.
It can perform execution-free verification using structured reasoning certificates,
or run empirical tests, or both.

## When to Use

- After making code changes to verify correctness
- To check if a fix actually solves the problem
- To verify patch equivalence (two different fixes produce same outcomes)
- When you want confidence before proceeding

## Modes

- **adaptive** (default): Try semi-formal first, fallback to empirical if uncertain
- **semi-formal**: Reasoning-based verification with structured certificates (faster, no sandbox)
- **empirical**: Run tests to verify (slower but definitive)
- **both**: Run both methods and compare results (highest confidence)

## Examples

Verify with adaptive mode (recommended):
<tool>verify</tool>
<parameter>mode</parameter>
<parameter>adaptive</parameter>
<parameter>description</parameter>
<parameter>Verify that the null check fix prevents the crash</parameter>

Verify specific file changes:
<tool>verify</tool>
<parameter>mode</parameter>
<parameter>semi-formal</parameter>
<parameter>description</parameter>
<parameter>Check if auth fix is correct</parameter>
<parameter>patches</parameter>
<parameter>[{"path": "src/auth.ts", "description": "Added null check"}]</parameter>

Run specific tests:
<tool>verify</tool>
<parameter>mode</parameter>
<parameter>empirical</parameter>
<parameter>description</parameter>
<parameter>Run auth tests</parameter>
<parameter>testFiles</parameter>
<parameter>["src/auth.test.ts"]</parameter>

## Confidence Levels

- **high**: Verification is very reliable (agreement between methods, or high-quality certificate)
- **medium**: Verification is reasonably reliable
- **low**: Verification is uncertain (disagreement between methods, or incomplete analysis)

The tool will fail if the actual confidence is below the required confidence.`,

    parameters: z.object({
      mode: z.enum(["empirical", "semi-formal", "both", "adaptive"])
        .default("adaptive")
        .describe("Verification mode. 'adaptive' tries semi-formal first, falls back to empirical. 'semi-formal' uses reasoning only. 'empirical' runs tests. 'both' runs both methods."),
      
      description: z.string()
        .describe("Clear description of what is being verified. This helps the verification system understand the context."),
      
      patches: z.array(z.object({
        path: z.string().describe("File path that was modified"),
        description: z.string().describe("Description of what changed in this file"),
      })).optional()
        .describe("List of code patches to verify. Include all files that were modified."),
      
      testFiles: z.array(z.string())
        .optional()
        .describe("Test files to run (for empirical mode). If not provided, tests will be auto-detected."),
      
      confidence: z.enum(["high", "medium", "low"])
        .default("medium")
        .describe("Minimum confidence required for verification to pass. If actual confidence is lower, verification will fail."),
    }),

    async execute(params, ctx) {
      log.info("Verify tool executing", {
        sessionId: ctx.sessionID,
        mode: params.mode,
        description: params.description,
      })

      try {
        // Build verification strategy
        const strategy: VerificationStrategy = {
          mode: params.mode,
          fallbackOnUncertainty: params.mode === "adaptive",
          context: {
            description: params.description,
            patches: params.patches?.map(p => ({
              path: p.path,
              content: p.description,
            })),
            testFiles: params.testFiles,
          },
        }

        // Create orchestrator
        const orchestrator = new VerificationOrchestrator(ctx.sessionID, strategy)

        // Create minimal plan/receipts since we're verifying the current state
        // In the future, this could pull from the actual session state
        const plan: Plan = { steps: [] }
        const receipts: ExecutionReceipt[] = []

        // Run verification
        const result = await orchestrator.verify(plan, receipts)

        // Store the verification result if we have a certificate
        let certificateId: string | undefined
        if (result.certificate) {
          try {
            certificateId = await storeVerification(result, ctx.sessionID, {
              type: "general",
              tags: [params.mode],
            })
          } catch (storeError) {
            log.warn("Failed to store verification", { error: storeError })
          }
        }

        // Check confidence requirement
        const confidenceOrder = { high: 3, medium: 2, low: 1 }
        const requiredConfidence = confidenceOrder[params.confidence]
        const actualConfidence = confidenceOrder[result.confidence]

        const confidenceMet = actualConfidence >= requiredConfidence

        // Build output
        const lines: string[] = []
        lines.push("━".repeat(60))
        lines.push("VERIFICATION RESULT")
        lines.push("━".repeat(60))
        lines.push("")
        
        const status = result.passed && confidenceMet ? "✓ PASSED" : "✗ FAILED"
        lines.push(`Status: ${status}`)
        lines.push(`Confidence: ${result.confidence} (required: ${params.confidence})`)
        lines.push(`Methods Used: ${result.methodsUsed.join(", ")}`)
        lines.push(`Consensus: ${result.consensus ? "Yes" : "DISAGREEMENT"}`)
        lines.push("")
        lines.push(`Reason: ${result.reason}`)
        
        if (result.certificate) {
          lines.push("")
          lines.push("Certificate Summary:")
          lines.push(`  Premises: ${result.certificate.premises.length}`)
          lines.push(`  Execution Traces: ${result.certificate.executionTraces.length}`)
          lines.push(`  Conclusion: ${result.certificate.conclusion.answer}`)
        }
        
        if (certificateId) {
          lines.push("")
          lines.push(`Certificate ID: ${certificateId}`)
        }
        
        lines.push("")
        lines.push(`Next Action: ${result.nextAction}`)
        lines.push("━".repeat(60))

        const output = lines.join("\n")

        // Return result
        return {
          title: `Verification ${result.passed && confidenceMet ? "PASSED" : "FAILED"} (${result.confidence})`,
          output,
          metadata: {
            passed: result.passed && confidenceMet,
            confidence: result.confidence,
            confidenceMet,
            methodsUsed: result.methodsUsed,
            consensus: result.consensus,
            nextAction: result.nextAction,
            certificateId,
            hasCertificate: !!result.certificate,
          },
        }
      } catch (error) {
        log.error("Verify tool failed", { error })
        
        return {
          title: "Verification Error",
          output: `Verification failed with error: ${error instanceof Error ? error.message : String(error)}`,
          metadata: {
            passed: false,
            error: error instanceof Error ? error.message : String(error),
          },
        }
      }
    },
  }
})
