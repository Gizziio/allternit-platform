/**
 * Verification API Routes
 * 
 * REST API endpoints for the verification system.
 */

import { Hono } from "hono";
import z from "zod/v4";
import { Log } from "@/shared/util/log";

import { VerificationOrchestrator } from "../verifiers/orchestrator";
import { VerificationStore } from "../storage/store";
import { formatCertificate, formatVerificationResult } from "../utils/formatting";
import { exportCertificate, exportVerificationReport } from "../utils/export";
import type { VerificationStrategy, VerificationContext } from "../types";

const log = Log.create({ service: "verification.api" });

// ============================================================================
// Request Schemas
// ============================================================================

const VerifyRequestSchema = z.object({
  mode: z.enum(["empirical", "semi-formal", "both", "adaptive"]).default("adaptive"),
  plan: z.object({
    steps: z.array(z.object({
      id: z.string(),
      toolId: z.string(),
      args: z.record(z.string(), z.any()).default({}),
    })),
  }),
  receipts: z.array(z.object({
    stepId: z.string(),
    toolId: z.string(),
    success: z.boolean(),
    output: z.string(),
    metadata: z.record(z.string(), z.any()).optional(),
  })).default([]),
  context: z.object({
    patches: z.array(z.object({
      id: z.string(),
      path: z.string(),
      description: z.string(),
      diff: z.string(),
      originalContent: z.string().optional(),
      modifiedContent: z.string().optional(),
      state: z.enum(["original", "modified"]),
    })).optional(),
    testFiles: z.array(z.string()).optional(),
    description: z.string().optional(),
  }).optional(),
  strategy: z.object({
    confidenceThreshold: z.number().min(0).max(1).optional(),
    fallbackOnUncertainty: z.boolean().optional(),
    timeouts: z.object({
      semiFormalMs: z.number().optional(),
      empiricalMs: z.number().optional(),
      totalMs: z.number().optional(),
    }).optional(),
  }).optional(),
});

const PatchEquivalenceRequestSchema = z.object({
  patch1: z.object({
    path: z.string(),
    diff: z.string(),
    description: z.string(),
  }),
  patch2: z.object({
    path: z.string(),
    diff: z.string(),
    description: z.string(),
  }),
  testContext: z.object({
    testPatch: z.string().optional(),
    repositoryContext: z.string(),
    relevantTests: z.array(z.string()),
    testDescriptions: z.record(z.string(), z.string()).optional(),
  }),
  options: z.object({
    requireCounterexample: z.boolean().default(true),
    traceDepth: z.number().int().positive().default(10),
  }).optional(),
});

const QueryRequestSchema = z.object({
  sessionId: z.string().optional(),
  type: z.enum(["patch_equivalence", "fault_localization", "code_qa", "general", "batch"]).optional(),
  passed: z.boolean().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  tags: z.array(z.string()).optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
  sortBy: z.enum(["timestamp", "confidence", "passed"]).default("timestamp"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const ConfirmRequestSchema = z.object({
  correct: z.boolean(),
  confirmedBy: z.string(),
  notes: z.string().optional(),
});

// ============================================================================
// Routes
// ============================================================================

export const verificationApiRoutes = new Hono()
  // Health check
  .get("/health", (c) => c.json({ status: "ok", service: "verification" }))
  
  // Verify execution
  .post("/verify", async (c) => {
    try {
      const bodyRaw = await c.req.json();
      const parseResult = VerifyRequestSchema.safeParse(bodyRaw);
      if (!parseResult.success) {
        return c.json({
          success: false,
          error: "Invalid request body",
          details: parseResult.error,
        }, 400);
      }
      const body = parseResult.data;
      const sessionId = c.req.header("X-Session-ID") || "anonymous";
      
      log.info("Verification request", {
        mode: body.mode,
        sessionId,
        steps: body.plan.steps.length,
      });
      
      const orchestrator = new VerificationOrchestrator(`api_${sessionId}`);
      
      const strategy: Partial<VerificationStrategy> = {
        mode: body.mode as VerificationStrategy["mode"],
        confidenceThreshold: body.strategy?.confidenceThreshold,
        fallbackOnUncertainty: body.strategy?.fallbackOnUncertainty,
        timeouts: body.strategy?.timeouts as { semiFormalMs: number; empiricalMs: number; totalMs: number; } | undefined,
      };
      
      const context: VerificationContext | undefined = body.context;
      
      const result = await orchestrator.verify(
        body.plan as unknown as import("../types").VerificationRequest["plan"],
        body.receipts as unknown as import("../types").VerificationRequest["receipts"],
        context,
        strategy
      );
      
      return c.json({
        success: true,
        data: {
          id: result.storage?.id,
          passed: result.passed,
          reason: result.reason,
          nextAction: result.nextAction,
          confidence: result.confidence,
          consensus: result.consensus,
          methodsUsed: result.methodsUsed,
          certificate: result.certificate,
          formattedCertificate: result.formattedCertificate,
          timing: result.timing,
        },
      });
    } catch (error) {
      log.error("Verification failed", { error });
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Verification failed",
      }, 500);
    }
  })
  
  // Patch equivalence
  .post("/patch-equivalence", async (c) => {
    try {
      const bodyRaw = await c.req.json();
      const parseResult = PatchEquivalenceRequestSchema.safeParse(bodyRaw);
      if (!parseResult.success) {
        return c.json({
          success: false,
          error: "Invalid request body",
          details: parseResult.error,
        }, 400);
      }
      const body = parseResult.data;
      const sessionId = c.req.header("X-Session-ID") || "anonymous";
      
      log.info("Patch equivalence request", {
        sessionId,
        patch1: body.patch1.path,
        patch2: body.patch2.path,
      });
      
      const orchestrator = new VerificationOrchestrator(`api_${sessionId}`);
      
      const result = await orchestrator.verifyPatchEquivalence({
        id: `pe_${Date.now()}`,
        sessionId,
        patch1: {
          id: "patch1",
          path: body.patch1.path,
          description: body.patch1.description,
          diff: body.patch1.diff,
          state: "modified",
        },
        patch2: {
          id: "patch2",
          path: body.patch2.path,
          description: body.patch2.description,
          diff: body.patch2.diff,
          state: "modified",
        },
        testContext: {
          ...body.testContext,
          testDescriptions: body.testContext.testDescriptions as Record<string, string> | undefined,
        },
        options: body.options || {
          requireCounterexample: true,
          traceDepth: 10,
        },
      });
      
      return c.json({
        success: true,
        data: {
          equivalent: result.passed,
          confidence: result.confidence,
          reason: result.reason,
          certificate: result.certificate,
          formattedCertificate: result.formattedCertificate,
          timing: result.timing,
        },
      });
    } catch (error) {
      log.error("Patch equivalence failed", { error });
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Patch equivalence failed",
      }, 500);
    }
  })
  
  // Query verifications
  .get("/verifications", async (c) => {
    try {
      const queryRaw = {
        sessionId: c.req.query("sessionId"),
        type: c.req.query("type"),
        passed: c.req.query("passed") === "true" ? true : c.req.query("passed") === "false" ? false : undefined,
        confidence: c.req.query("confidence"),
        tags: c.req.query("tags")?.split(","),
        since: c.req.query("since"),
        until: c.req.query("until"),
        search: c.req.query("search"),
        limit: c.req.query("limit") ? parseInt(c.req.query("limit")!, 10) : undefined,
        offset: c.req.query("offset") ? parseInt(c.req.query("offset")!, 10) : undefined,
        sortBy: c.req.query("sortBy"),
        sortOrder: c.req.query("sortOrder"),
      };
      const parseResult = QueryRequestSchema.safeParse(queryRaw);
      if (!parseResult.success) {
        return c.json({
          success: false,
          error: "Invalid query parameters",
          details: parseResult.error,
        }, 400);
      }
      const query = parseResult.data;
      const store = VerificationStore.getInstance();
      
      const results = await store.query({
        sessionId: query.sessionId,
        type: query.type,
        passed: query.passed,
        confidence: query.confidence,
        tags: query.tags,
        since: query.since ? new Date(query.since) : undefined,
        until: query.until ? new Date(query.until) : undefined,
        search: query.search,
        limit: query.limit,
        offset: query.offset,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });
      
      return c.json({
        success: true,
        data: results,
        meta: {
          count: results.length,
          limit: query.limit,
          offset: query.offset,
        },
      });
    } catch (error) {
      log.error("Query failed", { error });
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Query failed",
      }, 500);
    }
  })
  
  // Get single verification
  .get("/verifications/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const store = VerificationStore.getInstance();
      
      const verification = await store.get(id);
      
      if (!verification) {
        return c.json({
          success: false,
          error: "Verification not found",
        }, 404);
      }
      
      return c.json({
        success: true,
        data: verification,
      });
    } catch (error) {
      log.error("Get verification failed", { error });
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get verification",
      }, 500);
    }
  })
  
  // Confirm verification
  .post("/verifications/:id/confirm", async (c) => {
    try {
      const id = c.req.param("id");
      const bodyRaw = await c.req.json();
      const parseResult = ConfirmRequestSchema.safeParse(bodyRaw);
      if (!parseResult.success) {
        return c.json({
          success: false,
          error: "Invalid request body",
          details: parseResult.error,
        }, 400);
      }
      const body = parseResult.data;
      const store = VerificationStore.getInstance();
      
      await store.confirm(id, body.correct, body.confirmedBy, body.notes);
      
      return c.json({
        success: true,
        message: "Verification confirmed",
      });
    } catch (error) {
      log.error("Confirm failed", { error });
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Confirm failed",
      }, 500);
    }
  })
  
  // Get statistics
  .get("/statistics", async (c) => {
    try {
      const since = c.req.query("since");
      const until = c.req.query("until");
      
      const store = VerificationStore.getInstance();
      const stats = await store.getStatistics(
        since ? new Date(since) : undefined,
        until ? new Date(until) : undefined
      );
      
      return c.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      log.error("Statistics failed", { error });
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get statistics",
      }, 500);
    }
  })
  
  // Export certificate
  .get("/certificates/:id/export", async (c) => {
    try {
      const id = c.req.param("id");
      const format = (c.req.query("format") as "json" | "markdown" | "html") || "json";
      const includeMetadata = c.req.query("includeMetadata") !== "false";
      const includeRawEvidence = c.req.query("includeRawEvidence") === "true";
      
      const store = VerificationStore.getInstance();
      const verification = await store.get(id);
      
      if (!verification || !verification.certificate) {
        return c.json({
          success: false,
          error: "Certificate not found",
        }, 404);
      }
      
      const exported = exportCertificate(verification.certificate, {
        format,
        includeMetadata,
        includeRawEvidence,
        prettyPrint: true,
      });
      
      // Set content type based on format
      const contentTypeMap: Record<string, string> = {
        json: "application/json",
        markdown: "text/markdown",
        html: "text/html",
      };
      const contentType = contentTypeMap[format] || "text/plain";
      
      c.header("Content-Type", contentType);
      
      if (format !== "json") {
        c.header("Content-Disposition", `attachment; filename="certificate-${id}.${format}"`);
      }
      
      return c.body(exported);
    } catch (error) {
      log.error("Export failed", { error });
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Export failed",
      }, 500);
    }
  })
  
  // Get template
  .get("/template", async (c) => {
    const type = (c.req.query("type") as string) || "general";
    
    const templates: Record<string, string> = {
      general: "General verification template",
      patch_equivalence: "Patch equivalence template",
      fault_localization: "Fault localization template",
      code_qa: "Code QA template",
    };
    
    return c.json({
      success: true,
      data: {
        type,
        description: templates[type] || "Unknown template",
      },
    });
  });

// ============================================================================
// Export
// ============================================================================

export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;
export type PatchEquivalenceRequest = z.infer<typeof PatchEquivalenceRequestSchema>;
export type QueryRequest = z.infer<typeof QueryRequestSchema>;
export type ConfirmRequest = z.infer<typeof ConfirmRequestSchema>;
