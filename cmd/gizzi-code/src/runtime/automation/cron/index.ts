/**
 * A2R Cron - Unified TypeScript Cron System
 * 
 * Consolidated implementation replacing:
 * - Rust a2r-scheduler (deprecated)
 * - Previous in-memory CronService
 * 
 * Features:
 * - SQLite persistence (Bun built-in)
 * - Natural language scheduling
 * - Multiple job types (shell, http, agent, cowork, function)
 * - Daemon mode with HTTP API
 * - Run history and logs
 * 
 * Architecture based on research from:
 * - Supabase Cron (best-in-class UX)
 * - Vercel Cron (config-based simplicity)
 * - GitHub Actions (workflow integration)
 */

// Core Types
export type {
  // Job Types
  CronJob,
  JobType,
  JobStatus,
  ShellJob,
  HttpJob,
  AgentJob,
  CoworkJob,
  FunctionJob,
  
  // Run Types
  CronRun,
  RunStatus,
  
  // Schedule Types
  Schedule,
  CronSchedule,
  IntervalSchedule,
  ParsedSchedule,
  
  // API Types
  CreateJobInput,
  UpdateJobInput,
  ListJobsFilter,
  ListRunsFilter,
  
  // Event Types
  CronEvent,
  CronEventType,
  
  // Daemon Types
  DaemonConfig,
  DaemonStatus,
  CronServiceConfig,
} from "./types";

// Core Service
export { CronService } from "./service";

// Daemon Server
export { CronDaemon, startDaemon, isDaemonRunning, getRemoteStatus } from "./daemon";

// Schedule Parser
export {
  parseSchedule,
  parseScheduleToType,
  describeSchedule,
  getNextRunTime,
  suggestSchedules,
  COMMON_SCHEDULES,
} from "./parser";

// Database
export { CronDatabase } from "./database";

// ═══════════════════════════════════════════════════════════════════════════════
// Quick Start Examples
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Example 1: Local Mode (CLI attached)
 * 
 * ```typescript
 * import { CronService } from "./index";
 * 
 * // Initialize
 * CronService.initialize();
 * CronService.start();
 * 
 * // Create a job
 * const job = CronService.create({
 *   name: "Backup",
 *   type: "shell",
 *   schedule: "0 2 * * *", // Daily at 2am
 *   config: { command: "./backup.sh" },
 * });
 * 
 * // Or use natural language
 * const job2 = CronService.create({
 *   name: "Health Check",
 *   type: "http",
 *   schedule: "every 5 minutes",
 *   config: { url: "https://api.example.com/health", method: "GET" },
 * });
 * ```
 */

/**
 * Example 2: Daemon Mode (background server)
 * 
 * ```typescript
 * import { startDaemon } from "./index";
 * 
 * // Start daemon
 * const daemon = await startDaemon({
 *   port: 3031,
 *   dbPath: "~/.a2r/cron.db",
 * });
 * 
 * // Access via HTTP API
 * // GET  http://localhost:3031/jobs
 * // POST http://localhost:3031/jobs
 * // GET  http://localhost:3031/jobs/:id
 * // POST http://localhost:3031/jobs/:id/run
 * // POST http://localhost:3031/wake
 * ```
 */

/**
 * Example 3: Client Mode (connect to remote daemon)
 * 
 * ```typescript
 * import { getRemoteStatus } from "./index";
 * 
 * const status = await getRemoteStatus(3031);
 * console.log(`Daemon has ${status.jobs.active} active jobs`);
 * ```
 */

// Version
export const VERSION = "1.0.0";
