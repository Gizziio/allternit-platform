/**
 * Visual Verification API Routes
 * 
 * REST API endpoints for visual verification evidence.
 * Serves evidence files, status, and trend data.
 */

import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { Log } from "@/shared/util/log";
import { getEvidencePath, readEvidenceFile } from "./verification/file-writer";
import { ConfidenceHistoryStore } from "./verification/history/store";

const log = Log.create({ service: "visual-verification.api" });

// ============================================================================
// Request Schemas
// ============================================================================

const StartVerificationSchema = z.object({
  wihId: z.string(),
  artifactTypes: z.array(z.enum([
    "ui_state",
    "coverage_map", 
    "console_output",
    "visual_diff",
    "error_state"
  ])).optional(),
  timeout: z.number().optional(),
});

const BypassRequestSchema = z.object({
  reason: z.string().min(1),
  approver: z.string().email().optional(),
});

// ============================================================================
// Router
// ============================================================================

export const visualVerificationRouter = new Hono();

// Health check
visualVerificationRouter.get("/health", async (c) => {
  return c.json({
    status: "healthy",
    service: "visual-verification",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Get verification status for a WIH
visualVerificationRouter.get("/:wihId", async (c) => {
  const wihId = c.req.param("wihId");
  
  try {
    const evidence = await readEvidenceFile(wihId);
    
    if (!evidence) {
      return c.json({
        wihId,
        status: "pending",
        overallConfidence: 0,
        threshold: 0.7,
        artifacts: [],
        startedAt: new Date().toISOString(),
      }, 404);
    }
    
    return c.json({
      wihId,
      status: evidence.success ? "completed" : "failed",
      overallConfidence: evidence.overall_confidence,
      threshold: 0.7,
      artifacts: evidence.artifacts.map(a => ({
        id: a.id,
        type: a.type,
        confidence: a.confidence,
        timestamp: a.timestamp,
        data: {
          imageUrl: a.image?.path,
          textContent: a.text?.content,
          jsonData: a.json?.data,
        },
        metadata: a.metadata,
      })),
      startedAt: evidence.captured_at,
      completedAt: evidence.captured_at,
    });
  } catch (error) {
    log.error("Failed to get verification status", { wihId, error });
    return c.json({ error: "Failed to get verification status" }, 500);
  }
});

// Start verification
visualVerificationRouter.post("/:wihId/start", zValidator("json", StartVerificationSchema), async (c) => {
  const wihId = c.req.param("wihId");
  const body = c.req.valid("json");
  
  try {
    // Trigger visual capture
    const { captureForWih } = await import("./verification/visual/integration/autoland-adapter");
    const result = await captureForWih(wihId);
    
    return c.json({
      wihId,
      status: "running",
      overallConfidence: 0,
      threshold: 0.7,
      artifacts: [],
      startedAt: new Date().toISOString(),
    });
  } catch (error) {
    log.error("Failed to start verification", { wihId, error });
    return c.json({ 
      error: "Failed to start verification",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Cancel verification
visualVerificationRouter.post("/:wihId/cancel", async (c) => {
  const wihId = c.req.param("wihId");
  
  // In a real implementation, this would cancel ongoing captures
  log.info("Cancellation requested", { wihId });
  
  return c.json({ success: true, message: "Verification cancelled" });
});

// Request bypass
visualVerificationRouter.post("/:wihId/bypass", zValidator("json", BypassRequestSchema), async (c) => {
  const wihId = c.req.param("wihId");
  const body = c.req.valid("json");
  
  try {
    // Log bypass request for audit
    log.info("Bypass requested", { 
      wihId, 
      reason: body.reason,
      approver: body.approver,
      timestamp: new Date().toISOString()
    });
    
    // In production, this would:
    // 1. Create a bypass request in the database
    // 2. Send notification to approvers
    // 3. Wait for approval
    
    return c.json({
      success: true,
      message: "Bypass request submitted",
      requestId: `bypass_${Date.now()}`,
    });
  } catch (error) {
    log.error("Failed to request bypass", { wihId, error });
    return c.json({ error: "Failed to request bypass" }, 500);
  }
});

// Get trend data
visualVerificationRouter.get("/:wihId/trend", async (c) => {
  const wihId = c.req.param("wihId");
  const days = parseInt(c.req.query("days") || "7", 10);
  const limit = parseInt(c.req.query("limit") || "100", 10);
  
  try {
    const store = new ConfidenceHistoryStore();
    const trend = await store.getTrendForWih(wihId, days);
    
    return c.json(trend.map(t => ({
      timestamp: t.timestamp,
      confidence: t.confidence,
      wihId: t.wih_id,
    })));
  } catch (error) {
    log.error("Failed to get trend data", { wihId, error });
    return c.json({ error: "Failed to get trend data" }, 500);
  }
});

// Get artifact image
visualVerificationRouter.get("/:wihId/artifacts/:artifactId", async (c) => {
  const wihId = c.req.param("wihId");
  const artifactId = c.req.param("artifactId");
  
  try {
    const evidence = await readEvidenceFile(wihId);
    
    if (!evidence) {
      return c.json({ error: "Evidence not found" }, 404);
    }
    
    const artifact = evidence.artifacts.find(a => a.id === artifactId);
    
    if (!artifact || !artifact.image?.path) {
      return c.json({ error: "Artifact not found" }, 404);
    }
    
    // Serve the image file
    const file = Bun.file(artifact.image.path);
    
    if (!await file.exists()) {
      return c.json({ error: "Image file not found" }, 404);
    }
    
    return new Response(file);
  } catch (error) {
    log.error("Failed to get artifact", { wihId, artifactId, error });
    return c.json({ error: "Failed to get artifact" }, 500);
  }
});

// Export verification report
visualVerificationRouter.get("/:wihId/export", async (c) => {
  const wihId = c.req.param("wihId");
  const format = c.req.query("format") || "json";
  
  try {
    const evidence = await readEvidenceFile(wihId);
    
    if (!evidence) {
      return c.json({ error: "Evidence not found" }, 404);
    }
    
    if (format === "json") {
      return c.json(evidence);
    }
    
    // For PDF/HTML formats, would generate and return file
    return c.json({ error: "Format not yet supported" }, 400);
  } catch (error) {
    log.error("Failed to export report", { wihId, error });
    return c.json({ error: "Failed to export report" }, 500);
  }
});

// Batch verification
visualVerificationRouter.post("/batch", async (c) => {
  const body = await c.req.json();
  const { wihIds, options } = body;
  
  try {
    const results = await Promise.all(
      wihIds.map(async (wihId: string) => {
        const evidence = await readEvidenceFile(wihId);
        return {
          wihId,
          status: evidence?.success ? "completed" : "failed",
          overallConfidence: evidence?.overall_confidence || 0,
        };
      })
    );
    
    const passed = results.filter(r => r.overallConfidence >= 0.7).length;
    
    return c.json({
      results,
      summary: {
        total: results.length,
        passed,
        failed: results.length - passed,
      },
    });
  } catch (error) {
    log.error("Failed to process batch", { error });
    return c.json({ error: "Failed to process batch" }, 500);
  }
});

export default visualVerificationRouter;
