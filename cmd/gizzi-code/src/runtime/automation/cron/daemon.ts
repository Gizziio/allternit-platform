/**
 * HTTP Daemon Server for Cron Service
 * 
 * Provides REST API for remote job management.
 * Used in daemon mode when CLI exits but schedules need to run.
 * 
 * API Design inspired by:
 * - Supabase Cron API
 * - GitHub Actions API
 * - Vercel Cron webhooks
 */

import { CronService, type CronJob, type CronRun, type CreateJobInput, type UpdateJobInput } from "./service";
import { parseSchedule, describeSchedule } from "./parser";
import type { DaemonConfig, DaemonStatus } from "./types";

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP Server Implementation
// ═══════════════════════════════════════════════════════════════════════════════

interface ServerContext {
  config: DaemonConfig;
  startTime: Date;
}

export class CronDaemon {
  private server: ReturnType<typeof Bun.serve> | null = null;
  private context: ServerContext;
  private isRunning = false;

  constructor(config: Partial<DaemonConfig> = {}) {
    this.context = {
      config: {
        port: config.port ?? 3031,
        host: config.host ?? "127.0.0.1",
        dbPath: config.dbPath ?? `${process.env.HOME}/.a2r/cron.db`,
        checkIntervalMs: config.checkIntervalMs ?? 60000,
        logLevel: config.logLevel ?? "info",
        maxConcurrentJobs: config.maxConcurrentJobs ?? 10,
        jobTimeoutSeconds: config.jobTimeoutSeconds ?? 300,
      },
      startTime: new Date(),
    };
  }

  /**
   * Start the daemon
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("Daemon is already running");
    }

    // Initialize CronService
    CronService.initialize({
      dbPath: this.context.config.dbPath,
      checkIntervalMs: this.context.config.checkIntervalMs,
      maxConcurrentJobs: this.context.config.maxConcurrentJobs,
      defaultTimeoutSeconds: this.context.config.jobTimeoutSeconds,
    });

    // Start scheduler
    CronService.start();

    // Start HTTP server
    this.server = Bun.serve({
      port: this.context.config.port,
      hostname: this.context.config.host,
      fetch: (request: Request) => this.handleRequest(request),
    });

    this.isRunning = true;
    this.context.startTime = new Date();

    console.log(`[CronDaemon] Started on http://${this.context.config.host}:${this.context.config.port}`);
    console.log(`[CronDaemon] Database: ${this.context.config.dbPath}`);
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log("[CronDaemon] Stopping...");

    // Stop HTTP server
    this.server?.stop();
    this.server = null;

    // Stop CronService
    CronService.close();

    this.isRunning = false;
    console.log("[CronDaemon] Stopped");
  }

  /**
   * Check if daemon is running
   */
  isRunningDaemon(): boolean {
    return this.isRunning;
  }

  /**
   * Get daemon status
   */
  getStatus(): DaemonStatus {
    const cronStatus = CronService.getStatus();
    return {
      ...cronStatus,
      pid: process.pid,
      startedAt: this.context.startTime.toISOString(),
      version: "1.0.0",
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Request Router
  // ═══════════════════════════════════════════════════════════════════════════════

  private async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let response: Response;

      // Health check
      if (url.pathname === "/health") {
        response = this.jsonResponse({ status: "ok", timestamp: new Date().toISOString() });
      }
      // Status
      else if (url.pathname === "/status") {
        response = this.jsonResponse(this.getStatus());
      }
      // Jobs API
      else if (url.pathname === "/jobs" && method === "GET") {
        response = await this.listJobs(url.searchParams);
      }
      else if (url.pathname === "/jobs" && method === "POST") {
        response = await this.createJob(request);
      }
      else if (url.pathname.match(/^\/jobs\/[^/]+$/) && method === "GET") {
        const id = url.pathname.split("/")[2];
        response = await this.getJob(id);
      }
      else if (url.pathname.match(/^\/jobs\/[^/]+$/) && method === "PATCH") {
        const id = url.pathname.split("/")[2];
        response = await this.updateJob(id, request);
      }
      else if (url.pathname.match(/^\/jobs\/[^/]+$/) && method === "DELETE") {
        const id = url.pathname.split("/")[2];
        response = await this.deleteJob(id);
      }
      // Job actions
      else if (url.pathname.match(/^\/jobs\/[^/]+\/run$/) && method === "POST") {
        const id = url.pathname.split("/")[2];
        response = await this.triggerJob(id, request);
      }
      else if (url.pathname.match(/^\/jobs\/[^/]+\/pause$/) && method === "POST") {
        const id = url.pathname.split("/")[2];
        response = await this.pauseJob(id);
      }
      else if (url.pathname.match(/^\/jobs\/[^/]+\/resume$/) && method === "POST") {
        const id = url.pathname.split("/")[2];
        response = await this.resumeJob(id);
      }
      // Runs API
      else if (url.pathname.match(/^\/jobs\/[^/]+\/runs$/) && method === "GET") {
        const id = url.pathname.split("/")[2];
        response = await this.listRuns(id, url.searchParams);
      }
      else if (url.pathname.match(/^\/runs\/[^/]+$/) && method === "GET") {
        const id = url.pathname.split("/")[2];
        response = await this.getRun(id);
      }
      // Schedule parsing
      else if (url.pathname === "/parse-schedule" && method === "POST") {
        response = await this.parseSchedule(request);
      }
      // Wake schedules
      else if (url.pathname === "/wake" && method === "POST") {
        response = await this.wakeSchedules();
      }
      // Graceful shutdown
      else if (url.pathname === "/shutdown" && method === "POST") {
        response = this.jsonResponse({ status: "shutting down" });
        // Stop after response is sent
        setImmediate(() => this.stop());
      }
      // 404
      else {
        response = this.errorResponse("Not found", 404);
      }

      // Add CORS headers to all responses
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;

    } catch (error) {
      console.error("[CronDaemon] Request error:", error);
      return this.errorResponse(
        error instanceof Error ? error.message : "Internal server error",
        500
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Job Handlers
  // ═══════════════════════════════════════════════════════════════════════════════

  private async listJobs(params: URLSearchParams): Promise<Response> {
    const status = params.get("status") as CronJob["status"] | undefined;
    const type = params.get("type") as CronJob["type"] | undefined;
    const search = params.get("search") ?? undefined;

    let jobs = CronService.list();

    if (status) jobs = jobs.filter((j) => j.status === status);
    if (type) jobs = jobs.filter((j) => j.type === type);
    if (search) {
      const q = search.toLowerCase();
      jobs = jobs.filter((j) => 
        j.name.toLowerCase().includes(q) || 
        j.description?.toLowerCase().includes(q) ||
        j.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return this.jsonResponse({
      jobs: jobs.map(this.serializeJob),
      count: jobs.length,
    });
  }

  private async getJob(id: string): Promise<Response> {
    const job = CronService.get(id);
    if (!job) {
      return this.errorResponse("Job not found", 404);
    }

    // Include recent runs
    const runs = CronService.getRuns(id, 10);

    return this.jsonResponse({
      job: this.serializeJob(job),
      recentRuns: runs.map(this.serializeRun),
    });
  }

  private async createJob(request: Request): Promise<Response> {
    const body = await request.json() as CreateJobInput;

    // Validate required fields
    if (!body.name || !body.type || !body.schedule) {
      return this.errorResponse("Missing required fields: name, type, schedule", 400);
    }

    try {
      const job = CronService.create(body);
      return this.jsonResponse({ job: this.serializeJob(job) }, 201);
    } catch (error) {
      return this.errorResponse(
        error instanceof Error ? error.message : "Failed to create job",
        400
      );
    }
  }

  private async updateJob(id: string, request: Request): Promise<Response> {
    const body = await request.json() as UpdateJobInput;

    try {
      const job = CronService.update(id, body);
      return this.jsonResponse({ job: this.serializeJob(job) });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return this.errorResponse("Job not found", 404);
      }
      return this.errorResponse(
        error instanceof Error ? error.message : "Failed to update job",
        400
      );
    }
  }

  private async deleteJob(id: string): Promise<Response> {
    const success = CronService.delete(id);
    if (!success) {
      return this.errorResponse("Job not found", 404);
    }
    return this.jsonResponse({ success: true });
  }

  private async triggerJob(id: string, request: Request): Promise<Response> {
    const job = CronService.get(id);
    if (!job) {
      return this.errorResponse("Job not found", 404);
    }

    // Get optional user info from request
    let userId: string | undefined;
    try {
      const body = await request.json() as { userId?: string };
      userId = body.userId;
    } catch {
      // No body, that's ok
    }

    try {
      const run = await CronService.run(id, userId);
      return this.jsonResponse({ run: this.serializeRun(run) }, 202);
    } catch (error) {
      return this.errorResponse(
        error instanceof Error ? error.message : "Failed to trigger job",
        500
      );
    }
  }

  private async pauseJob(id: string): Promise<Response> {
    const job = CronService.get(id);
    if (!job) {
      return this.errorResponse("Job not found", 404);
    }

    const updated = CronService.pause(id);
    return this.jsonResponse({ job: this.serializeJob(updated) });
  }

  private async resumeJob(id: string): Promise<Response> {
    const job = CronService.get(id);
    if (!job) {
      return this.errorResponse("Job not found", 404);
    }

    const updated = CronService.resume(id);
    return this.jsonResponse({ job: this.serializeJob(updated) });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Run Handlers
  // ═══════════════════════════════════════════════════════════════════════════════

  private async listRuns(jobId: string, params: URLSearchParams): Promise<Response> {
    const job = CronService.get(jobId);
    if (!job) {
      return this.errorResponse("Job not found", 404);
    }

    const limit = parseInt(params.get("limit") ?? "100", 10);
    const runs = CronService.getRuns(jobId, limit);

    return this.jsonResponse({
      runs: runs.map(this.serializeRun),
      jobId,
      count: runs.length,
    });
  }

  private async getRun(id: string): Promise<Response> {
    const run = CronService.getRun(id);
    if (!run) {
      return this.errorResponse("Run not found", 404);
    }

    return this.jsonResponse({ run: this.serializeRun(run) });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Utility Handlers
  // ═══════════════════════════════════════════════════════════════════════════════

  private async parseSchedule(request: Request): Promise<Response> {
    const body = await request.json() as { schedule: string };
    
    if (!body.schedule) {
      return this.errorResponse("Missing 'schedule' field", 400);
    }

    const parsed = parseSchedule(body.schedule);
    if (!parsed) {
      return this.errorResponse("Could not parse schedule", 400);
    }

    return this.jsonResponse({
      input: body.schedule,
      parsed,
      description: describeSchedule(
        parsed.type === "interval"
          ? { type: "interval", seconds: parsed.seconds ?? 60 }
          : { type: "cron", expression: parsed.expression }
      ),
    });
  }

  private async wakeSchedules(): Promise<Response> {
    const count = CronService.wake();
    return this.jsonResponse({ 
      message: "Schedules checked",
      jobsTriggered: count,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Serialization
  // ═══════════════════════════════════════════════════════════════════════════════

  private serializeJob(job: CronJob): Record<string, unknown> {
    return {
      id: job.id,
      name: job.name,
      description: job.description,
      type: job.type,
      status: job.status,
      schedule: {
        type: job.schedule.type,
        expression: job.schedule.type === "cron" ? job.schedule.expression : undefined,
        seconds: job.schedule.type === "interval" ? job.schedule.seconds : undefined,
        timezone: job.schedule.type === "cron" ? job.schedule.timezone : undefined,
      },
      scheduleDescription: describeSchedule(job.schedule),
      nextRunAt: job.nextRunAt,
      lastRunAt: job.lastRunAt,
      runCount: job.runCount,
      failCount: job.failCount,
      tags: job.tags,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  private serializeRun(run: CronRun): Record<string, unknown> {
    return {
      id: run.id,
      jobId: run.jobId,
      status: run.status,
      scheduledAt: run.scheduledAt,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      durationMs: run.durationMs,
      triggeredBy: run.triggeredBy,
      attempt: run.attempt,
      output: run.output,
      error: run.error,
      httpStatus: run.httpStatus,
      agentId: run.agentId,
      tokensUsed: run.tokensUsed,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Response Helpers
  // ═══════════════════════════════════════════════════════════════════════════════

  private jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data, null, 2), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  private errorResponse(message: string, status = 400): Response {
    return new Response(
      JSON.stringify({ error: message }, null, 2),
      {
        status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI Helper
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start the daemon from CLI
 */
export async function startDaemon(config: Partial<DaemonConfig> = {}): Promise<CronDaemon> {
  const daemon = new CronDaemon(config);
  await daemon.start();
  return daemon;
}

/**
 * Check if daemon is running on a given port
 */
export async function isDaemonRunning(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Stop a running daemon by sending a shutdown request
 */
export async function stopRemoteDaemon(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/shutdown`, {
      method: "POST",
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get daemon status from a running instance
 */
export async function getRemoteStatus(port: number): Promise<DaemonStatus | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/status`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return null;
    return await response.json() as DaemonStatus;
  } catch {
    return null;
  }
}
