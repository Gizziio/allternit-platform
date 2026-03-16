/**
 * SQLite Database Layer for Cron Persistence
 * 
 * Uses Bun's built-in SQLite for zero-config durability.
 * All jobs and runs are persisted to ~/.a2r/cron.db
 */

import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import type { CronJob, CronRun, CronEvent } from "./types";

// ═══════════════════════════════════════════════════════════════════════════════
// Database Schema
// ═══════════════════════════════════════════════════════════════════════════════

const SCHEMA = `
-- Jobs table: stores all scheduled jobs
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK(type IN ('shell', 'http', 'agent', 'cowork', 'function')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'disabled', 'error')),
  
  -- Schedule
  schedule_type TEXT NOT NULL CHECK(schedule_type IN ('cron', 'interval')),
  schedule_expression TEXT,
  schedule_seconds INTEGER,
  schedule_timezone TEXT,
  
  -- Execution configuration (JSON)
  config TEXT NOT NULL,
  
  -- Timing
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_run_at TEXT,
  next_run_at TEXT,
  
  -- Limits
  max_runs INTEGER,
  run_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  
  -- Timeout and retry
  timeout_seconds INTEGER DEFAULT 300,
  max_retries INTEGER DEFAULT 0,
  retry_delay_seconds INTEGER DEFAULT 60,
  
  -- Metadata
  tags TEXT, -- JSON array
  metadata TEXT -- JSON object
);

-- Runs table: stores execution history
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'success', 'failed', 'cancelled', 'timeout')),
  
  -- Timing
  scheduled_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  duration_ms INTEGER,
  
  -- Execution details
  attempt INTEGER NOT NULL DEFAULT 1,
  retry_of TEXT,
  
  -- Results
  output TEXT,
  error TEXT,
  exit_code INTEGER,
  http_status INTEGER,
  
  -- Agent-specific
  agent_id TEXT,
  response TEXT,
  tokens_used INTEGER,
  
  -- Trigger info
  triggered_by TEXT NOT NULL CHECK(triggered_by IN ('schedule', 'manual', 'api', 'retry', 'wake')),
  triggered_by_user TEXT,
  metadata TEXT, -- JSON object
  
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- Events table: audit log
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  data TEXT -- JSON
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_next_run ON jobs(next_run_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_runs_job_id ON runs(job_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
`;

// ═══════════════════════════════════════════════════════════════════════════════
// Database Class
// ═══════════════════════════════════════════════════════════════════════════════

export class CronDatabase {
  private db: Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = this.initialize();
  }

  private initialize(): Database {
    // Ensure directory exists
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Open database
    const db = new Database(this.dbPath);
    db.exec(SCHEMA);
    
    return db;
  }

  close(): void {
    this.db.close();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Job Operations
  // ═══════════════════════════════════════════════════════════════════════════════

  saveJob(job: CronJob): void {
    const stmt = this.db.prepare(`
      INSERT INTO jobs (
        id, name, description, type, status,
        schedule_type, schedule_expression, schedule_seconds, schedule_timezone,
        config, created_at, updated_at, last_run_at, next_run_at,
        max_runs, run_count, fail_count, timeout_seconds, max_retries, retry_delay_seconds,
        tags, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        status = excluded.status,
        schedule_type = excluded.schedule_type,
        schedule_expression = excluded.schedule_expression,
        schedule_seconds = excluded.schedule_seconds,
        schedule_timezone = excluded.schedule_timezone,
        config = excluded.config,
        updated_at = excluded.updated_at,
        last_run_at = excluded.last_run_at,
        next_run_at = excluded.next_run_at,
        max_runs = excluded.max_runs,
        run_count = excluded.run_count,
        fail_count = excluded.fail_count,
        timeout_seconds = excluded.timeout_seconds,
        max_retries = excluded.max_retries,
        retry_delay_seconds = excluded.retry_delay_seconds,
        tags = excluded.tags,
        metadata = excluded.metadata
    `);

    stmt.run(
      job.id,
      job.name,
      job.description ?? null,
      job.type,
      job.status,
      job.schedule.type,
      job.schedule.type === "cron" ? job.schedule.expression : null,
      job.schedule.type === "interval" ? job.schedule.seconds : null,
      job.schedule.type === "cron" ? job.schedule.timezone ?? null : null,
      JSON.stringify(job.config),
      job.createdAt,
      job.updatedAt,
      job.lastRunAt ?? null,
      job.nextRunAt ?? null,
      job.maxRuns ?? null,
      job.runCount,
      job.failCount,
      job.timeoutSeconds ?? 300,
      job.maxRetries ?? 0,
      job.retryDelaySeconds ?? 60,
      JSON.stringify(job.tags),
      JSON.stringify(job.metadata)
    );
  }

  getJob(id: string): CronJob | null {
    const stmt = this.db.prepare("SELECT * FROM jobs WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToJob(row) : null;
  }

  getAllJobs(): CronJob[] {
    const stmt = this.db.prepare("SELECT * FROM jobs ORDER BY created_at DESC");
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map((r) => this.rowToJob(r));
  }

  getActiveJobs(): CronJob[] {
    const stmt = this.db.prepare("SELECT * FROM jobs WHERE status = 'active' ORDER BY next_run_at ASC");
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map((r) => this.rowToJob(r));
  }

  getJobsDueBefore(threshold: string): CronJob[] {
    const stmt = this.db.prepare(
      "SELECT * FROM jobs WHERE status = 'active' AND next_run_at <= ? ORDER BY next_run_at ASC"
    );
    const rows = stmt.all(threshold) as Record<string, unknown>[];
    return rows.map((r) => this.rowToJob(r));
  }

  deleteJob(id: string): boolean {
    const stmt = this.db.prepare("DELETE FROM jobs WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Run Operations
  // ═══════════════════════════════════════════════════════════════════════════════

  saveRun(run: CronRun): void {
    const stmt = this.db.prepare(`
      INSERT INTO runs (
        id, job_id, status, scheduled_at, started_at, finished_at, duration_ms,
        attempt, retry_of, output, error, exit_code, http_status,
        agent_id, response, tokens_used, triggered_by, triggered_by_user, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        started_at = excluded.started_at,
        finished_at = excluded.finished_at,
        duration_ms = excluded.duration_ms,
        output = excluded.output,
        error = excluded.error,
        exit_code = excluded.exit_code,
        http_status = excluded.http_status,
        agent_id = excluded.agent_id,
        response = excluded.response,
        tokens_used = excluded.tokens_used,
        metadata = excluded.metadata
    `);

    stmt.run(
      run.id,
      run.jobId,
      run.status,
      run.scheduledAt,
      run.startedAt ?? null,
      run.finishedAt ?? null,
      run.durationMs ?? null,
      run.attempt,
      run.retryOf ?? null,
      run.output ?? null,
      run.error ?? null,
      run.exitCode ?? null,
      run.httpStatus ?? null,
      run.agentId ?? null,
      run.response ?? null,
      run.tokensUsed ?? null,
      run.triggeredBy,
      run.triggeredByUser ?? null,
      JSON.stringify(run.metadata)
    );
  }

  getRun(id: string): CronRun | null {
    const stmt = this.db.prepare("SELECT * FROM runs WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToRun(row) : null;
  }

  getRunsByJob(jobId: string, limit = 100): CronRun[] {
    const stmt = this.db.prepare(
      "SELECT * FROM runs WHERE job_id = ? ORDER BY scheduled_at DESC LIMIT ?"
    );
    const rows = stmt.all(jobId, limit) as Record<string, unknown>[];
    return rows.map((r) => this.rowToRun(r));
  }

  getPendingRuns(): CronRun[] {
    const stmt = this.db.prepare(
      "SELECT * FROM runs WHERE status = 'pending' ORDER BY scheduled_at ASC"
    );
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map((r) => this.rowToRun(r));
  }

  getRunningRuns(): CronRun[] {
    const stmt = this.db.prepare(
      "SELECT * FROM runs WHERE status = 'running' ORDER BY started_at ASC"
    );
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map((r) => this.rowToRun(r));
  }

  getRecentRuns(limit = 50): CronRun[] {
    const stmt = this.db.prepare(
      "SELECT * FROM runs ORDER BY scheduled_at DESC LIMIT ?"
    );
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map((r) => this.rowToRun(r));
  }

  deleteOldRuns(olderThan: string): number {
    const stmt = this.db.prepare("DELETE FROM runs WHERE scheduled_at < ?");
    const result = stmt.run(olderThan);
    return result.changes;
  }

  /**
   * Get database size in bytes
   */
  getDatabaseSize(): number {
    try {
      const row = this.db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get() as { size: number } | undefined;
      return row?.size ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Vacuum the database to reclaim space
   */
  vacuum(): void {
    this.db.exec("VACUUM");
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Event Operations
  // ═══════════════════════════════════════════════════════════════════════════════

  logEvent(event: CronEvent): void {
    const stmt = this.db.prepare(
      "INSERT INTO events (type, timestamp, data) VALUES (?, ?, ?)"
    );
    stmt.run(event.type, event.timestamp, JSON.stringify(event.data));
  }

  getRecentEvents(limit = 100): CronEvent[] {
    const stmt = this.db.prepare(
      "SELECT * FROM events ORDER BY timestamp DESC LIMIT ?"
    );
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map((r) => ({
      type: r.type as CronEvent["type"],
      timestamp: r.timestamp as string,
      data: JSON.parse((r.data as string) ?? "{}") as unknown,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Statistics
  // ═══════════════════════════════════════════════════════════════════════════════

  getStats(): {
    jobs: { total: number; active: number; paused: number };
    runs: { pending: number; running: number; last24h: number };
  } {
    const jobStats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused
      FROM jobs
    `).get() as { total: number; active: number; paused: number };

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const runStats = this.db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN scheduled_at > ? THEN 1 ELSE 0 END) as last24h
      FROM runs
    `).get(yesterday) as { pending: number; running: number; last24h: number };

    return {
      jobs: jobStats,
      runs: runStats,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Row Mappers
  // ═══════════════════════════════════════════════════════════════════════════════

  private rowToJob(row: Record<string, unknown>): CronJob {
    const base = {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      type: row.type as CronJob["type"],
      status: row.status as CronJob["status"],
      schedule: {
        type: row.schedule_type as "cron" | "interval",
        ...(row.schedule_type === "cron"
          ? { expression: row.schedule_expression as string, timezone: row.schedule_timezone as string | undefined }
          : { seconds: row.schedule_seconds as number }
        ),
      } as CronJob["schedule"],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      lastRunAt: row.last_run_at as string | undefined,
      nextRunAt: row.next_run_at as string | undefined,
      maxRuns: row.max_runs as number | undefined,
      runCount: row.run_count as number,
      failCount: row.fail_count as number,
      timeoutSeconds: row.timeout_seconds as number | undefined,
      maxRetries: row.max_retries as number | undefined,
      retryDelaySeconds: row.retry_delay_seconds as number | undefined,
      tags: JSON.parse((row.tags as string) ?? "[]"),
      metadata: JSON.parse((row.metadata as string) ?? "{}"),
    };

    const config = JSON.parse(row.config as string);

    return { ...base, config } as CronJob;
  }

  private rowToRun(row: Record<string, unknown>): CronRun {
    return {
      id: row.id as string,
      jobId: row.job_id as string,
      status: row.status as CronRun["status"],
      scheduledAt: row.scheduled_at as string,
      startedAt: row.started_at as string | undefined,
      finishedAt: row.finished_at as string | undefined,
      durationMs: row.duration_ms as number | undefined,
      attempt: row.attempt as number,
      retryOf: row.retry_of as string | undefined,
      output: row.output as string | undefined,
      error: row.error as string | undefined,
      exitCode: row.exit_code as number | undefined,
      httpStatus: row.http_status as number | undefined,
      agentId: row.agent_id as string | undefined,
      response: row.response as string | undefined,
      tokensUsed: row.tokens_used as number | undefined,
      triggeredBy: row.triggered_by as CronRun["triggeredBy"],
      triggeredByUser: row.triggered_by_user as string | undefined,
      metadata: JSON.parse((row.metadata as string) ?? "{}"),
    };
  }
}
