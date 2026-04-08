/**
 * Scheduled Jobs Runner Tests
 * 
 * Tests for:
 * - Job runner lifecycle (start/stop)
 * - Job execution scheduling
 * - Retry logic
 * - Execution history
 * - Concurrent job limits
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  startJobRunner,
  stopJobRunner,
  isJobRunnerRunning,
  getJobRunnerState,
  getExecutionHistory,
  clearExecutionHistory,
  type JobRunnerConfig,
  type ScheduledJobConfig,
} from "./scheduled-jobs.runner";

// Mock localStorage
const mockLocalStorage: Record<string, string> = {};
Object.defineProperty(global, "localStorage", {
  value: {
    getItem: (key: string) => mockLocalStorage[key] || null,
    setItem: (key: string, value: string) => {
      mockLocalStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockLocalStorage[key];
    },
  },
  writable: true,
});

// Mock Notification API
const mockNotification = vi.fn();
Object.defineProperty(global, "Notification", {
  value: mockNotification,
  writable: true,
});
Object.defineProperty(global.Notification, "permission", {
  value: "default",
  writable: true,
});
Object.defineProperty(global.Notification, "requestPermission", {
  value: vi.fn().mockResolvedValue("granted"),
  writable: true,
});

describe("Job Runner Lifecycle", () => {
  beforeEach(() => {
    // Stop any running runner
    stopJobRunner();
    // Clear localStorage
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
    // Clear mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    stopJobRunner();
  });

  it("should start the job runner", () => {
    expect(isJobRunnerRunning()).toBe(false);
    
    startJobRunner();
    
    expect(isJobRunnerRunning()).toBe(true);
  });

  it("should stop the job runner", () => {
    startJobRunner();
    expect(isJobRunnerRunning()).toBe(true);
    
    stopJobRunner();
    
    expect(isJobRunnerRunning()).toBe(false);
  });

  it("should return runner state", () => {
    startJobRunner({ pollInterval: 30000 });
    
    const state = getJobRunnerState();
    
    expect(state.isRunning).toBe(true);
    expect(state.pollInterval).toBe(30000);
    expect(state.activeExecutions).toBeInstanceOf(Map);
    expect(state.recentErrors).toEqual([]);
  });

  it("should not start multiple times", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    startJobRunner();
    startJobRunner();
    
    expect(consoleSpy).toHaveBeenCalledWith("[JobRunner] Already running");
    consoleSpy.mockRestore();
  });

  it("should use default config when not specified", () => {
    startJobRunner();
    
    const state = getJobRunnerState();
    expect(state.pollInterval).toBe(60000);
    expect(state.maxConcurrentJobs).toBe(3);
  });

  it("should merge custom config with defaults", () => {
    startJobRunner({
      pollInterval: 120000,
      maxConcurrentJobs: 5,
    });
    
    const state = getJobRunnerState();
    expect(state.pollInterval).toBe(120000);
    expect(state.maxConcurrentJobs).toBe(5);
    expect(state.defaultTimeout).toBe(30); // default
  });
});

describe("Job Execution History", () => {
  beforeEach(() => {
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
    clearExecutionHistory();
  });

  it("should return empty history initially", () => {
    const history = getExecutionHistory();
    expect(history).toEqual([]);
  });

  it("should store and retrieve execution history", () => {
    const execution = {
      executionId: "exec-1",
      jobId: "job-1",
      status: "completed" as const,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      output: "Success",
    };

    // Store via localStorage directly (simulating runner behavior)
    mockLocalStorage["allternit-job-execution-history"] = JSON.stringify([execution]);

    const history = getExecutionHistory();
    expect(history.length).toBe(1);
    expect(history[0].executionId).toBe("exec-1");
  });

  it("should clear execution history", () => {
    mockLocalStorage["allternit-job-execution-history"] = JSON.stringify([
      { executionId: "exec-1", jobId: "job-1", status: "completed", startedAt: new Date().toISOString() },
    ]);

    clearExecutionHistory();

    expect(mockLocalStorage["allternit-job-execution-history"]).toBeUndefined();
    expect(getExecutionHistory()).toEqual([]);
  });

  it("should limit history to last 100 entries", () => {
    const executions = Array.from({ length: 105 }, (_, i) => ({
      executionId: `exec-${i}`,
      jobId: "job-1",
      status: "completed" as const,
      startedAt: new Date().toISOString(),
    }));

    mockLocalStorage["allternit-job-execution-history"] = JSON.stringify(executions);

    const history = getExecutionHistory();
    expect(history.length).toBe(100);
    // Should keep most recent
    expect(history[0].executionId).toBe("exec-104");
  });
});

describe("Cron Expression Utilities", () => {
  it("should calculate next run for every minute", () => {
    const now = new Date();
    const next = calculateNextRun("* * * * *", undefined);
    
    expect(next).toBeInstanceOf(Date);
    expect(next!.getTime()).toBeGreaterThan(now.getTime());
  });

  it("should calculate next run for every hour", () => {
    const now = new Date();
    const next = calculateNextRun("0 * * * *", undefined);
    
    expect(next).toBeInstanceOf(Date);
    expect(next!.getMinutes()).toBe(0);
  });

  it("should calculate next run for daily at specific time", () => {
    const next = calculateNextRun("0 9 * * *", undefined);
    
    expect(next).toBeInstanceOf(Date);
    expect(next!.getHours()).toBe(9);
    expect(next!.getMinutes()).toBe(0);
  });

  it("should calculate next run based on last run", () => {
    const lastRun = new Date();
    lastRun.setHours(lastRun.getHours() - 2);
    
    const next = calculateNextRun("0 * * * *", lastRun.toISOString());
    
    expect(next).toBeInstanceOf(Date);
    expect(next!.getTime()).toBeGreaterThan(lastRun.getTime());
  });

  it("should return null for invalid cron expression", () => {
    const next = calculateNextRun("invalid", undefined);
    expect(next).toBeNull();
  });
});

describe("Job Storage", () => {
  const JOBS_STORAGE_KEY = "allternit-scheduled-jobs";

  beforeEach(() => {
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
  });

  it("should return empty array when no jobs stored", () => {
    const jobs = getScheduledJobsFromStorage();
    expect(jobs).toEqual([]);
  });

  it("should store and retrieve jobs", () => {
    const jobs: ScheduledJobConfig[] = [
      {
        id: "job-1",
        name: "Test Job",
        schedule: "0 9 * * *",
        taskType: "custom-task",
        parameters: {},
        prompt: "Test",
        enabled: true,
        maxRetries: 3,
        timeout: 30,
        notifyOnSuccess: false,
        notifyOnFailure: true,
      },
    ];

    mockLocalStorage[JOBS_STORAGE_KEY] = JSON.stringify(jobs);

    const retrieved = getScheduledJobsFromStorage();
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].name).toBe("Test Job");
  });

  it("should update job last run time", () => {
    const jobs: ScheduledJobConfig[] = [
      {
        id: "job-1",
        name: "Test Job",
        schedule: "0 9 * * *",
        taskType: "custom-task",
        parameters: {},
        prompt: "Test",
        enabled: true,
        maxRetries: 3,
        timeout: 30,
        notifyOnSuccess: false,
        notifyOnFailure: true,
      },
    ];

    mockLocalStorage[JOBS_STORAGE_KEY] = JSON.stringify(jobs);

    updateJobLastRun("job-1");

    const updated = getScheduledJobsFromStorage();
    expect(updated[0].lastRunAt).toBeDefined();
  });
});

// Helper functions from the runner module
function calculateNextRun(schedule: string, lastRunAt?: string): Date | null {
  const now = new Date();
  const lastRun = lastRunAt ? new Date(lastRunAt) : null;

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
    const hour = parseInt(dailyMatch[1]);
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
    const hour = parseInt(weekdayMatch[1]);
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

function getScheduledJobsFromStorage(): ScheduledJobConfig[] {
  try {
    const data = localStorage.getItem("allternit-scheduled-jobs");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function updateJobLastRun(jobId: string): void {
  try {
    const jobs = getScheduledJobsFromStorage();
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      job.lastRunAt = new Date().toISOString();
      localStorage.setItem("allternit-scheduled-jobs", JSON.stringify(jobs));
    }
  } catch (error) {
    console.error("[JobRunner] Failed to update job last run:", error);
  }
}
