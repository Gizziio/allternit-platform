/**
 * Verify Tool
 * 
 * Built-in tool for running verification during agent execution.
 */

import { z } from "zod/v4";
import { Log } from "@/shared/util/log";
import { VerificationOrchestrator } from "../verifiers/orchestrator";
import type { Tool, ToolContext } from "@/runtime/tools/builtins/tool";

const log = Log.create({ service: "tools.verify" });

// ============================================================================
// Tool Definition
// ============================================================================

export const VerifyToolInputSchema = z.object({
  mode: z.enum(["empirical", "semi-formal", "both", "adaptive"])
    .default("adaptive")
    .describe("Verification mode to use"),
  
  description: z.string()
    .describe("Description of what is being verified"),
  
  patches: z.array(z.object({
    path: z.string().describe("File path"),
    description: z.string().describe("Description of changes"),
  })).optional()
    .describe("Code patches to verify"),
  
  testFiles: z.array(z.string())
    .optional()
    .describe("Test files to run"),
  
  confidence: z.enum(["high", "medium", "low"])
    .default("high")
    .describe("Minimum confidence required"),
});

export type VerifyToolInput = z.infer<typeof VerifyToolInputSchema>;

export const VerifyTool: Tool<typeof VerifyToolInputSchema> = {
  name: "verify",
  
  description: `Verify code changes using semi-formal reasoning or test execution.

This tool uses Meta's Agentic Code Reasoning approach to verify code without
necessarily executing it. It can also run empirical tests when needed.

Examples:
- Verify mode="adaptive" description="Check if the bug fix is correct"
- Verify mode="semi-formal" description="Verify patch equivalence" patches=[{path:"src/file.ts",description:"Fix null check"}]
- Verify mode="empirical" testFiles=["src/file.test.ts"]`,
  
  parameters: VerifyToolInputSchema,
  
  returns: z.object({
    passed: z.boolean().describe("Whether verification passed"),
    confidence: z.enum(["high", "medium", "low"]),
    reason: z.string(),
    certificateId: z.string().optional(),
  }),
  
  async execute(input: VerifyToolInput, context: ToolContext) {
    log.info("Verify tool executing", {
      sessionId: context.sessionId,
      mode: input.mode,
      description: input.description,
    });
    
    try {
      const orchestrator = new VerificationOrchestrator(
        `tool_${context.sessionId}`,
        { defaultMode: input.mode }
      );
      
      // Build context from input
      const verificationContext = {
        description: input.description,
        patches: input.patches?.map((p, i) => ({
          id: `patch_${i}`,
          path: p.path,
          description: p.description,
          diff: "",
          state: "modified" as const,
        })),
        testFiles: input.testFiles,
      };
      
      // Create minimal plan and receipts for verification
      const plan = { steps: [] };
      const receipts = [];
      
      const result = await orchestrator.verify(
        plan as any,
        receipts as any,
        verificationContext
      );
      
      // Check confidence requirement
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      const requiredConfidence = confidenceOrder[input.confidence];
      const actualConfidence = confidenceOrder[result.confidence];
      
      if (actualConfidence < requiredConfidence) {
        return {
          passed: false,
          confidence: result.confidence,
          reason: `Confidence too low: ${result.confidence} (required: ${input.confidence}). ${result.reason}`,
          certificateId: result.storage?.id,
        };
      }
      
      return {
        passed: result.passed,
        confidence: result.confidence,
        reason: result.reason,
        certificateId: result.storage?.id,
      };
    } catch (error) {
      log.error("Verify tool failed", { error });
      throw error;
    }
  },
};
