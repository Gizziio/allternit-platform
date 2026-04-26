/**
 * Enhanced CronService with Production Features
 * 
 * This is the production-ready implementation with:
 * - Timezone support
 * - Exponential backoff retry
 * - Job timeout enforcement
 * - Graceful shutdown
 * - Log rotation
 * - Real executor integrations
 */

import { CronDatabase } from "./database";
import { parseScheduleToType, describeSchedule } from "./parser";
import { calculateNextRun } from "./utils/timezone";
import { withRetry, RetryableErrors, type RetryConfig } from "./utils/retry";
import { AgentExecutor, type AgentExecutorConfig } from "./executors/agent-executor";
import { CoworkExecutor, type CoworkExecutorConfig } from "./executors/cowork-executor";
import { VaultSyncExecutor } from "./executors/vault-sync-executor";
import { getFunction, listRegisteredFunctions, registerFunction } from "./executors/function-registry";
import { runAgentQueueWorker } from "./workers/agent-queue";
import type {
  CronJob,
  CronRun,
  CreateJobInput,
  UpdateJobInput,
  CronServiceConfig,
  CronEvent,
  DaemonStatus,
  RunStatus,
} from "./types";
import { homedir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { createLogger } from "./utils/logger";

const log = createLogger("cron-service");

// ═══════════════════════════════════════════════════════════════════════════════
// State Management
// ═══════════════════════════════════════════════════════════════════════════════

interface ServiceState {
  db: CronDatabase | null;
  timer: ReturnType<typeof setInterval> | null;
  isRunning: boolean;
  isShuttingDown: boolean;
  config: Required<CronServiceConfig> & {
    retry: RetryConfig;
    agent?: AgentExecutorConfig;
    cowork?: CoworkExecutorConfig;
  };
  runningJobs: Map<string, { 
    abortController: AbortController; 
    startTime: Date;
    timeoutId?: ReturnType<typeof setTimeout>;
  }>;
  eventListeners: Set<(event: CronEvent) => void>;
  executors: {
    agent?: AgentExecutor;
    cowork?: CoworkExecutor;
  };
  metrics: {
    jobsStarted: number;
    jobsCompleted: number;
    jobsFailed: number;
    lastCheckAt?: Date;
  };
}

const DEFAULT_CONFIG: ServiceState["config"] = {
  dbPath: join(homedir(), ".allternit", "cron.db"),
  checkIntervalMs: 60000,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  maxConcurrentJobs: 10,
  defaultTimeoutSeconds: 300,
  defaultMaxRetries: 0,
  onJobExecute: async () => {},
  onJobComplete: async () => {},
  onJobError: async () => {},
  emitEvent: () => {},
  retry: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    exponential: true,
    isRetryable: RetryableErrors.standard,
  },
};

let state: ServiceState = {
  db: null,
  timer: null,
  isRunning: false,
  isShuttingDown: false,
  config: DEFAULT_CONFIG,
  runningJobs: new Map(),
  eventListeners: new Set(),
  executors: {},
  metrics: {
    jobsStarted: 0,
    jobsCompleted: 0,
    jobsFailed: 0,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

export const CronServiceEnhanced = {
  // ═══════════════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════════════════════

  initialize(config: Partial<ServiceState["config"]> = {}): void {
    if (state.db) {
      throw new Error("CronService already initialized");
    }

    state.config = { ...DEFAULT_CONFIG, ...config };
    state.db = new CronDatabase(state.config.dbPath);

    // Initialize executors if configs provided
    if (state.config.agent) {
      state.executors.agent = new AgentExecutor(state.config.agent);
    }
    if (state.config.cowork) {
      state.executors.cowork = new CoworkExecutor(state.config.cowork);
    }

    // Auto-register agent queue worker if configured
    if (state.config.agentQueue) {
      this.registerAgentQueueJob(state.config.agentQueue);
    }

    // Schedule log rotation
    this.scheduleLogRotation();

    log.info("CronService initialized", {
      dbPath: state.config.dbPath,
      timezone: state.config.timezone,
    });

    emitEvent({
      type: "daemon:started",
      timestamp: new Date().toISOString(),
      data: { dbPath: state.config.dbPath, timezone: state.config.timezone },
    });
  },

  start(): void {
    if (state.isRunning) return;
    if (!state.db) throw new Error("CronService not initialized");

    state.isRunning = true;
    state.isShuttingDown = false;

    // Schedule next runs for all active jobs
    const jobs = state.db.getActiveJobs();
    for (const job of jobs) {
      if (!job.nextRunAt) {
        this._scheduleNextRun(job);
      }
    }

    // Start the check timer
    state.timer = setInterval(() => this._checkDueJobs(), state.config.checkIntervalMs);

    log.info("CronService scheduler started", {
      checkIntervalMs: state.config.checkIntervalMs,
      activeJobs: jobs.length,
    });
  },

  /**
   * Graceful shutdown - waits for running jobs to complete
   */
  async stop(options: { force?: boolean; timeoutMs?: number } = {}): Promise<void> {
    const { force = false, timeoutMs = 30000 } = options;

    if (!state.isRunning) return;

    log.info("CronService shutting down...", { force, timeoutMs });
    state.isShuttingDown = true;
    state.isRunning = false;

    // Stop the timer
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }

    if (!force) {
      // Wait for running jobs to complete
      const startTime = Date.now();
      while (state.runningJobs.size > 0) {
        if (Date.now() - startTime > timeoutMs) {
          log.warn("Shutdown timeout reached, forcing cancellation", {
            remainingJobs: state.runningJobs.size,
          });
          break;
        }
        log.info("Waiting for jobs to complete...", {
          remainingJobs: state.runningJobs.size,
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Cancel any remaining jobs
    for (const [jobId, jobInfo] of state.runningJobs) {
      log.info("Cancelling job during shutdown", { jobId });
      jobInfo.abortController.abort();
      if (jobInfo.timeoutId) clearTimeout(jobInfo.timeoutId);
    }
    state.runningJobs.clear();

    // Close database
    state.db?.close();
    state.db = null;

    state.isShuttingDown = false;

    emitEvent({
      type: "daemon:stopped",
      timestamp: new Date().toISOString(),
      data: { graceful: !force },
    });

    log.info("CronService stopped");
  },

  close(): void {
    this.stop({ force: true, timeoutMs: 0 }).catch((err) => {
      log.error("Error during close", { error: err.message });
    });
  },

  isRunning(): boolean {
    return state.isRunning;
  },

  isShuttingDown(): boolean {
    return state.isShuttingDown;
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Job Management
  // ═══════════════════════════════════════════════════════════════════════════════

  create(input: CreateJobInput): CronJob {
    if (!state.db) throw new Error("CronService not initialized");

    const schedule = typeof input.schedule === "string"
      ? parseScheduleToType(input.schedule)
      : input.schedule;

    if (!schedule) {
      throw new Error(`Invalid schedule: ${input.schedule}`);
    }

    const now = new Date().toISOString();
    const job = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      type: input.type,
      status: input.status ?? "active",
      schedule,
      config: input.config as CronJob["config"],
      createdAt: now,
      updatedAt: now,
      runCount: 0,
      failCount: 0,
      maxRuns: input.maxRuns,
      timeoutSeconds: input.timeoutSeconds ?? state.config.defaultTimeoutSeconds,
      maxRetries: input.maxRetries ?? state.config.defaultMaxRetries,
      tags: input.tags ?? [],
      metadata: input.metadata ?? {},
    } as CronJob;

    // Calculate next run with timezone support
    if (schedule.type === "cron") {
      const nextRun = calculateNextRun(
        schedule.expression,
        schedule.timezone ?? state.config.timezone,
        new Date()
      );
      job.nextRunAt = nextRun.toISOString();
    } else {
      // Interval schedule
      const nextRun = new Date(Date.now() + schedule.seconds * 1000);
      job.nextRunAt = nextRun.toISOString();
    }

    state.db.saveJob(job);

    log.info("Created job", {
      jobId: job.id,
      name: job.name,
      type: job.type,
      schedule: describeSchedule(schedule),
    });

    emitEvent({
      type: "job:created",
      timestamp: now,
      data: { jobId: job.id, name: job.name },
    });

    return job;
  },

  get(id: string): CronJob | null {
    if (!state.db) throw new Error("CronService not initialized");
    return state.db.getJob(id);
  },

  list(): CronJob[] {
    if (!state.db) throw new Error("CronService not initialized");
    return state.db.getAllJobs();
  },

  listActive(): CronJob[] {
    if (!state.db) throw new Error("CronService not initialized");
    return state.db.getActiveJobs();
  },

  update(id: string, input: UpdateJobInput): CronJob {
    if (!state.db) throw new Error("CronService not initialized");

    const job = state.db.getJob(id);
    if (!job) throw new Error(`Job not found: ${id}`);

    // Update fields
    if (input.name !== undefined) job.name = input.name;
    if (input.description !== undefined) job.description = input.description;
    if (input.status !== undefined) job.status = input.status;
    if (input.maxRuns !== undefined) job.maxRuns = input.maxRuns;
    if (input.timeoutSeconds !== undefined) job.timeoutSeconds = input.timeoutSeconds;
    if (input.maxRetries !== undefined) job.maxRetries = input.maxRetries;
    if (input.tags !== undefined) job.tags = input.tags;

    // Update schedule
    if (input.schedule) {
      const schedule = typeof input.schedule === "string"
        ? parseScheduleToType(input.schedule)
        : input.schedule;
      if (schedule) {
        job.schedule = schedule;
        this._scheduleNextRun(job);
      }
    }

    // Update config
    if (input.config) {
      job.config = { ...job.config, ...input.config } as CronJob["config"];
    }

    job.updatedAt = new Date().toISOString();
    state.db.saveJob(job);

    log.info("Updated job", { jobId: job.id, name: job.name });

    emitEvent({
      type: "job:updated",
      timestamp: job.updatedAt,
      data: { jobId: job.id },
    });

    return job;
  },

  pause(id: string): CronJob {
    const job = this.update(id, { status: "paused" });
    emitEvent({
      type: "job:paused",
      timestamp: new Date().toISOString(),
      data: { jobId: id },
    });
    return job;
  },

  resume(id: string): CronJob {
    const job = this.update(id, { status: "active" });
    this._scheduleNextRun(job);
    emitEvent({
      type: "job:resumed",
      timestamp: new Date().toISOString(),
      data: { jobId: id },
    });
    return job;
  },

  delete(id: string): boolean {
    if (!state.db) throw new Error("CronService not initialized");

    const success = state.db.deleteJob(id);
    if (success) {
      emitEvent({
        type: "job:deleted",
        timestamp: new Date().toISOString(),
        data: { jobId: id },
      });
      log.info("Deleted job", { jobId: id });
    }
    return success;
  },

  registerAgentQueueJob(config: { agentId: string; agentRole?: string; schedule?: string | import("./types").Schedule }): CronJob {
    if (!state.db) throw new Error("CronService not initialized");

    // Check if already registered
    const existing = state.db.getAllJobs().find((j) => j.name === "agent-queue-worker");
    if (existing) {
      log.info("Agent queue job already registered", { jobId: existing.id });
      return existing;
    }

    // Register the worker function statically (safe for compiled binaries)
    registerFunction("agent-queue-worker", runAgentQueueWorker as (...args: unknown[]) => unknown);

    const schedule = config.schedule ?? "*/1 * * * *"; // Every minute by default

    const job = this.create({
      name: "agent-queue-worker",
      description: "Polls task queue and claims pending items for agent execution",
      type: "function",
      schedule,
      config: {
        function: "agent-queue-worker",
        args: [{ agentId: config.agentId, agentRole: config.agentRole }],
      },
      tags: ["agent", "queue", "builtin"],
    });

    log.info("Registered agent queue job", { jobId: job.id, agentId: config.agentId });
    return job;
  },

  async run(id: string, triggeredByUser?: string): Promise<CronRun> {
    if (!state.db) throw new Error("CronService not initialized");

    const job = state.db.getJob(id);
    if (!job) throw new Error(`Job not found: ${id}`);

    return this._executeJob(job, "manual", triggeredByUser);
  },

  wake(): number {
    return this._checkDueJobs();
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Run History
  // ═══════════════════════════════════════════════════════════════════════════════

  getRuns(jobId: string, limit = 100): CronRun[] {
    if (!state.db) throw new Error("CronService not initialized");
    return state.db.getRunsByJob(jobId, limit);
  },

  getRecentRuns(limit = 50): CronRun[] {
    if (!state.db) throw new Error("CronService not initialized");
    return state.db.getRecentRuns(limit);
  },

  getRun(id: string): CronRun | null {
    if (!state.db) throw new Error("CronService not initialized");
    return state.db.getRun(id);
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Statistics & Status
  // ═══════════════════════════════════════════════════════════════════════════════

  getStatus(): DaemonStatus & { metrics?: typeof state.metrics } {
    if (!state.db) {
      return {
        running: false,
        port: 0,
        jobs: { total: 0, active: 0, paused: 0 },
        runs: { pending: 0, running: 0, last24h: 0 },
        version: "1.0.0",
        metrics: state.metrics,
      };
    }

    const stats = state.db.getStats();
    return {
      running: state.isRunning,
      port: 0,
      jobs: stats.jobs,
      runs: stats.runs,
      version: "1.0.0",
      metrics: state.metrics,
    };
  },

  getMetrics() {
    return { ...state.metrics };
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Log Rotation
  // ═══════════════════════════════════════════════════════════════════════════════

  scheduleLogRotation(): void {
    // Clean up old runs daily
    const cleanup = () => {
      if (!state.db) return;
      
      // Delete runs older than 90 days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const deleted = state.db.deleteOldRuns(cutoff.toISOString());
      
      if (deleted > 0) {
        log.info("Log rotation cleanup", { deletedRuns: deleted });
      }
    };

    // Run immediately
    cleanup();
    
    // Schedule daily cleanup
    const msUntilNextDay = (24 - new Date().getHours()) * 60 * 60 * 1000;
    setTimeout(() => {
      cleanup();
      setInterval(cleanup, 24 * 60 * 60 * 1000);
    }, msUntilNextDay);
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Event Handling
  // ═══════════════════════════════════════════════════════════════════════════════

  onEvent(handler: (event: CronEvent) => void): () => void {
    state.eventListeners.add(handler);
    return () => state.eventListeners.delete(handler);
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // Internal Methods
  // ═══════════════════════════════════════════════════════════════════════════════

  _checkDueJobs(): number {
    if (!state.db || !state.isRunning || state.isShuttingDown) return 0;

    const now = new Date().toISOString();
    const dueJobs = state.db.getJobsDueBefore(now);
    let executed = 0;

    state.metrics.lastCheckAt = new Date();

    for (const job of dueJobs) {
      // Skip if max runs reached
      if (job.maxRuns && job.runCount >= job.maxRuns) {
        job.status = "disabled";
        state.db.saveJob(job);
        continue;
      }

      // Skip if too many concurrent jobs
      if (state.runningJobs.size >= state.config.maxConcurrentJobs) {
        log.warn("Max concurrent jobs reached, skipping", { jobId: job.id, name: job.name });
        continue;
      }

      // Execute with retry logic
      this._executeJob(job, "schedule");
      executed++;
    }

    if (executed > 0) {
      log.info("Executed due jobs", { count: executed });
    }

    return executed;
  },

  async _executeJob(job: CronJob, triggeredBy: CronRun["triggeredBy"], triggeredByUser?: string): Promise<CronRun> {
    if (!state.db) throw new Error("CronService not initialized");

    const runId = randomUUID();
    const now = new Date().toISOString();

    // Create run record
    const run: CronRun = {
      id: runId,
      jobId: job.id,
      status: "pending",
      scheduledAt: now,
      attempt: 1,
      triggeredBy,
      triggeredByUser,
      metadata: {},
    };

    state.db.saveRun(run);
    state.metrics.jobsStarted++;

    // Create abort controller for this job
    const abortController = new AbortController();
    const timeoutMs = (job.timeoutSeconds ?? state.config.defaultTimeoutSeconds) * 1000;
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      log.warn("Job timeout reached, aborting", { jobId: job.id, runId });
      abortController.abort();
    }, timeoutMs);

    state.runningJobs.set(job.id, { 
      abortController, 
      startTime: new Date(),
      timeoutId,
    });

    emitEvent({
      type: "job:run:started",
      timestamp: now,
      data: { jobId: job.id, runId, name: job.name },
    });

    const startTime = Date.now();

    try {
      run.status = "running";
      run.startedAt = new Date().toISOString();
      state.db.saveRun(run);

      // Execute with retry logic
      const retryConfig: Partial<RetryConfig> = {
        maxAttempts: (job.maxRetries ?? 0) + 1,
        isRetryable: RetryableErrors.standard,
        onRetry: (attempt, delay, error) => {
          run.attempt = attempt + 1;
          emitEvent({
            type: "job:run:retry",
            timestamp: new Date().toISOString(),
            data: { jobId: job.id, runId, attempt: run.attempt, error: error.message },
          });
        },
      };

      await withRetry(async () => {
        await this._executeJobByType(job, run, abortController.signal);
      }, retryConfig);

      // Success
      run.status = "success";
      run.finishedAt = new Date().toISOString();
      run.durationMs = Date.now() - startTime;

      job.lastRunAt = run.startedAt;
      job.runCount++;
      state.metrics.jobsCompleted++;

      emitEvent({
        type: "job:run:completed",
        timestamp: run.finishedAt,
        data: { jobId: job.id, runId, durationMs: run.durationMs },
      });

      await state.config.onJobComplete(job, run);

    } catch (error) {
      // Failure
      run.status = "failed";
      run.error = error instanceof Error ? error.message : String(error);
      run.finishedAt = new Date().toISOString();
      run.durationMs = Date.now() - startTime;

      job.failCount++;
      state.metrics.jobsFailed++;

      emitEvent({
        type: "job:run:failed",
        timestamp: run.finishedAt,
        data: { jobId: job.id, runId, error: run.error },
      });

      await state.config.onJobError(job, run, error instanceof Error ? error : new Error(String(error)));
    } finally {
      // Cleanup
      clearTimeout(timeoutId);
      state.runningJobs.delete(job.id);
      state.db?.saveRun(run);
      state.db?.saveJob(job);

      // Schedule next run
      if (job.status === "active" && !state.isShuttingDown) {
        this._scheduleNextRun(job);
      }
    }

    return run;
  },

  async _executeJobByType(job: CronJob, run: CronRun, signal: AbortSignal): Promise<void> {
    switch (job.type) {
      case "shell":
        await this._executeShell(job, run, signal);
        break;
      case "http":
        await this._executeHttp(job, run, signal);
        break;
      case "agent":
        if (!state.executors.agent) {
          throw new Error("Agent executor not configured");
        }
        await state.executors.agent.execute(job, run, signal);
        break;
      case "cowork":
        if (!state.executors.cowork) {
          throw new Error("Cowork executor not configured");
        }
        await state.executors.cowork.execute(job, run, signal);
        break;
      case "function":
        await this._executeFunction(job, run, signal);
        break;
      case "vault":
        await this._executeVault(job, run, signal);
        break;
      default: {
        // Exhaustiveness check - should never reach here if all job types are handled
        const _exhaustiveCheck: never = job;
        throw new Error(`Unknown job type: ${(_exhaustiveCheck as { type: string }).type}`);
      }
    }
  },

  async _executeShell(job: CronJob, run: CronRun, signal: AbortSignal): Promise<void> {
    const config = job.config as { command: string; cwd?: string; env?: Record<string, string>; shell?: string };

    const proc = Bun.spawn({
      cmd: [config.shell ?? "bash", "-c", config.command],
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      signal,
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    run.output = stdout;
    if (stderr) run.error = stderr;
    run.exitCode = exitCode;

    if (exitCode !== 0) {
      throw new Error(`Command failed with exit code ${exitCode}: ${stderr || stdout}`);
    }
  },

  async _executeHttp(job: CronJob, run: CronRun, signal: AbortSignal): Promise<void> {
    const config = job.config as { 
      url: string; 
      method: string; 
      headers?: Record<string, string>; 
      body?: string; 
      timeoutSeconds?: number;
    };

    const timeoutMs = (config.timeoutSeconds ?? 30) * 1000;
    const controller = new AbortController();

    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Link external signal
    signal.addEventListener("abort", () => controller.abort());

    try {
      const response = await fetch(config.url, {
        method: config.method,
        headers: config.headers,
        body: config.body,
        signal: controller.signal,
      });

      run.httpStatus = response.status;
      run.output = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${run.output}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async _executeFunction(job: CronJob, run: CronRun, _signal: AbortSignal): Promise<void> {
    const config = job.config as { function: string; args: unknown[] };

    const fn = getFunction(config.function);
    if (!fn) {
      throw new Error(
        `Function "${config.function}" is not registered. ` +
        `Available functions: ${listRegisteredFunctions().join(", ") || "none"}. ` +
        `Register functions with registerFunction() before creating cron jobs.`
      );
    }

    try {
      const result = await fn(...config.args);
      run.output = JSON.stringify(result, null, 2);
    } catch (error) {
      throw new Error(`Function "${config.function}" execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  async _executeVault(job: CronJob, run: CronRun, signal: AbortSignal): Promise<void> {
    const executor = new VaultSyncExecutor({})
    await executor.execute(job, run, signal)
  },

  _scheduleNextRun(job: CronJob): void {
    let nextRun: Date;

    if (job.schedule.type === "cron") {
      nextRun = calculateNextRun(
        job.schedule.expression,
        job.schedule.timezone ?? state.config.timezone,
        new Date()
      );
    } else {
      nextRun = new Date(Date.now() + job.schedule.seconds * 1000);
    }

    job.nextRunAt = nextRun.toISOString();
    state.db?.saveJob(job);

    emitEvent({
      type: "job:run:scheduled",
      timestamp: new Date().toISOString(),
      data: { jobId: job.id, nextRunAt: job.nextRunAt },
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Event Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function emitEvent(event: CronEvent): void {
  state.db?.logEvent(event);

  for (const handler of state.eventListeners) {
    try {
      handler(event);
    } catch (e) {
      log.error("Event handler error", { error: e instanceof Error ? e.message : String(e) });
    }
  }

  state.config.emitEvent(event);
}
