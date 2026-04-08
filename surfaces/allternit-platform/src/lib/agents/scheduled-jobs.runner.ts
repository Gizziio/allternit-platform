/**
 * Scheduled Jobs Runner
 * 
 * Background job execution engine that polls for due jobs.
 * Uses the real scheduled jobs service - NO localStorage.
 */

import {
  executeScheduledJob,
  listScheduledJobs,
  type ScheduledJobConfig,
  type JobExecution,
} from "./scheduled-jobs.service";

export type { ScheduledJobConfig, JobExecution };

// ============================================================================
// Types
// ============================================================================

export interface JobRunnerConfig {
  pollInterval: number; // ms
  maxConcurrentJobs: number;
  defaultTimeout: number; // minutes
  enableNotifications: boolean;
}

export interface JobRunnerState {
  isRunning: boolean;
  pollInterval: number;
  maxConcurrentJobs: number;
  defaultTimeout: number;
  enableNotifications: boolean;
  lastPollAt: string | null;
  activeExecutions: Map<string, JobExecution>;
  recentErrors: Array<{ jobId: string; error: string; timestamp: string }>;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: JobRunnerConfig = {
  pollInterval: 60000, // 1 minute
  maxConcurrentJobs: 3,
  defaultTimeout: 30,
  enableNotifications: true,
};

// ============================================================================
// Runner State
// ============================================================================

let runnerState: JobRunnerState = {
  isRunning: false,
  pollInterval: DEFAULT_CONFIG.pollInterval,
  maxConcurrentJobs: DEFAULT_CONFIG.maxConcurrentJobs,
  defaultTimeout: DEFAULT_CONFIG.defaultTimeout,
  enableNotifications: DEFAULT_CONFIG.enableNotifications,
  lastPollAt: null,
  activeExecutions: new Map(),
  recentErrors: [],
};

let pollTimer: ReturnType<typeof setInterval> | null = null;

// ============================================================================
// Job Runner Functions
// ============================================================================

/**
 * Start the job runner
 */
export function startJobRunner(userConfig?: Partial<JobRunnerConfig>): void {
  if (runnerState.isRunning) {
    console.log("[JobRunner] Already running");
    return;
  }

  // Merge config
  if (userConfig) {
    runnerState.pollInterval = userConfig.pollInterval ?? DEFAULT_CONFIG.pollInterval;
    runnerState.maxConcurrentJobs = userConfig.maxConcurrentJobs ?? DEFAULT_CONFIG.maxConcurrentJobs;
    runnerState.defaultTimeout = userConfig.defaultTimeout ?? DEFAULT_CONFIG.defaultTimeout;
    runnerState.enableNotifications = userConfig.enableNotifications ?? DEFAULT_CONFIG.enableNotifications;
  }

  runnerState.isRunning = true;
  console.log("[JobRunner] Started with config:", {
    pollInterval: runnerState.pollInterval,
    maxConcurrentJobs: runnerState.maxConcurrentJobs,
    defaultTimeout: runnerState.defaultTimeout,
  });

  // Immediate first poll
  void pollJobs();

  // Schedule regular polls
  pollTimer = setInterval(() => void pollJobs(), runnerState.pollInterval);

  // Request notification permission if enabled
  if (runnerState.enableNotifications && "Notification" in window) {
    Notification.requestPermission().catch(() => {
      // Ignore permission errors
    });
  }
}

/**
 * Stop the job runner
 */
export function stopJobRunner(): void {
  runnerState.isRunning = false;

  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  console.log("[JobRunner] Stopped");
}

/**
 * Check if runner is active
 */
export function isJobRunnerRunning(): boolean {
  return runnerState.isRunning;
}

/**
 * Get current runner state
 */
export function getJobRunnerState(): JobRunnerState {
  return { ...runnerState };
}

// ============================================================================
// Polling & Execution
// ============================================================================

/**
 * Poll for jobs that are due to run
 */
async function pollJobs(): Promise<void> {
  if (!runnerState.isRunning) return;

  runnerState.lastPollAt = new Date().toISOString();

  try {
    // Fetch scheduled jobs from the backend
    const jobs = await listScheduledJobs();
    const now = new Date();

    // Find jobs that are due
    const dueJobs = jobs.filter((job) => {
      if (!job.enabled) return false;
      if (runnerState.activeExecutions.has(job.id!)) return false;

      const nextRun = calculateNextRun(job.schedule, job.lastRunAt);
      return nextRun <= now;
    });

    // Execute due jobs (respecting max concurrent)
    const jobsToRun = dueJobs.slice(0, runnerState.maxConcurrentJobs);

    for (const job of jobsToRun) {
      void executeJob(job);
    }

    if (jobsToRun.length > 0) {
      console.log(`[JobRunner] Executed ${jobsToRun.length} scheduled jobs`);
    }
  } catch (error) {
    console.error("[JobRunner] Poll failed:", error);
    // Track error
    runnerState.recentErrors.unshift({
      jobId: "poll",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
    // Keep last 10 errors
    runnerState.recentErrors = runnerState.recentErrors.slice(0, 10);
  }
}

/**
 * Execute a single scheduled job
 */
async function executeJob(job: ScheduledJobConfig): Promise<void> {
  const jobId = job.id!;
  const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Create execution record
  const execution: JobExecution = {
    executionId,
    jobId,
    status: "running",
    startedAt: new Date().toISOString(),
  };

  runnerState.activeExecutions.set(jobId, execution);

  try {
    console.log(`[JobRunner] Executing job: ${job.name}`);

    // Execute the job via the service
    const result = await executeScheduledJob(job);

    // Update execution record
    execution.status = result.error ? "failed" : "completed";
    execution.completedAt = result.completedAt;
    execution.output = result.output;
    execution.error = result.error;

    // Handle result
    if (result.error) {
      handleJobError(job, result.error);
    } else {
      handleJobSuccess(job, result);
    }

    // Note: The backend should update lastRunAt and runCount automatically
    // We don't update these via the API as they're system-managed fields
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    execution.status = "failed";
    execution.error = errorMsg;
    handleJobError(job, errorMsg);
  } finally {
    // Keep execution in state for a bit, then remove
    setTimeout(() => {
      runnerState.activeExecutions.delete(jobId);
    }, 5000);
  }
}

// ============================================================================
// Result Handlers
// ============================================================================

function handleJobSuccess(job: ScheduledJobConfig, result: JobExecution): void {
  console.log(`[JobRunner] Job succeeded: ${job.name}`);

  if (runnerState.enableNotifications && job.notifyOnSuccess) {
    sendNotification(`✅ ${job.name}`, `Scheduled job completed successfully`, "success");
  }
}

function handleJobError(job: ScheduledJobConfig, error: string): void {
  console.error(`[JobRunner] Job failed: ${job.name}`, error);

  // Track error
  runnerState.recentErrors.unshift({
    jobId: job.id!,
    error,
    timestamp: new Date().toISOString(),
  });
  runnerState.recentErrors = runnerState.recentErrors.slice(0, 10);

  if (runnerState.enableNotifications && job.notifyOnFailure) {
    sendNotification(`❌ ${job.name}`, `Scheduled job failed: ${error.slice(0, 100)}`, "error");
  }

  // Retry logic is handled by the job configuration, not here
  // The backend should handle retries based on maxRetries setting
}

function sendNotification(title: string, body: string, type: "success" | "error"): void {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    new Notification(title, {
      body,
      icon: type === "success" ? "/icon-success.png" : "/icon-error.png",
      badge: "/badge.png",
      tag: `job-${type}`,
    });
  } catch (error) {
    console.error("[JobRunner] Notification failed:", error);
  }
}

// ============================================================================
// Cron Utilities
// ============================================================================

/**
 * Calculate the next run time for a job
 */
function calculateNextRun(schedule: string, lastRunAt?: string): Date {
  const now = new Date();
  const lastRun = lastRunAt ? new Date(lastRunAt) : null;

  // Simple cron parsing for common patterns
  // In production, use a proper cron library

  // Every minute
  if (schedule === "* * * * *") {
    return new Date(now.getTime() + 60000);
  }

  // Every hour
  if (schedule === "0 * * * *") {
    const next = new Date(now);
    next.setHours(next.getHours() + 1);
    next.setMinutes(0);
    next.setSeconds(0);
    return next;
  }

  // Every day at specific time
  const dailyMatch = schedule.match(/^0 (\d+) \* \* \*$/);
  if (dailyMatch) {
    const hourStr = dailyMatch[1];
    if (!hourStr) throw new Error('Invalid cron: missing hour');
    const hour = parseInt(hourStr, 10);
    if (isNaN(hour)) throw new Error(`Invalid hour: ${hourStr}`);
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  // Every weekday
  const weekdayMatch = schedule.match(/^0 (\d+) \* \* (\d-\d|\d,?\d*)$/);
  if (weekdayMatch) {
    const hourStr = weekdayMatch[1];
    if (!hourStr) throw new Error('Invalid cron: missing hour');
    const hour = parseInt(hourStr, 10);
    if (isNaN(hour)) throw new Error(`Invalid hour: ${hourStr}`);
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    
    while (next <= now || (next.getDay() === 0 || next.getDay() === 6)) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  // Default: 1 hour from now
  return new Date(now.getTime() + 3600000);
}

// ============================================================================
// React Hook
// ============================================================================

import { useState, useEffect, useCallback } from "react";

// Execution history (in-memory only - backend should provide this)
const executionHistory: JobExecution[] = [];

export function getExecutionHistory(): JobExecution[] {
  return [...executionHistory];
}

export function clearExecutionHistory(): void {
  executionHistory.length = 0;
}

export function useJobRunner() {
  const [isRunning, setIsRunning] = useState(false);
  const [state, setState] = useState<JobRunnerState>(runnerState);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsRunning(runnerState.isRunning);
      setState({ ...runnerState });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const start = useCallback((userConfig?: Partial<JobRunnerConfig>) => {
    startJobRunner(userConfig);
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    stopJobRunner();
    setIsRunning(false);
  }, []);

  return {
    isRunning,
    state,
    start,
    stop,
    getHistory: getExecutionHistory,
    clearHistory: clearExecutionHistory,
  };
}
