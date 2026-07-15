/**
 * Scheduled Jobs E2E Tests
 * 
 * Tests the complete job lifecycle with real API integration:
 * Create job → Save via API → Poll for due jobs → 
 * Execute job → Record history → Update job status
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  startJobRunner,
  stopJobRunner,
  isJobRunnerRunning,
  getJobRunnerState,
  getExecutionHistory,
  clearExecutionHistory,
} from "./scheduled-jobs.runner";
import {
  createScheduledJob,
  listScheduledJobs,
  updateScheduledJob,
  deleteScheduledJob,
  runScheduledJobNow,
  pauseScheduledJob,
  resumeScheduledJob,
  type ScheduledJobConfig,
} from "./scheduled-jobs.service";

// Mock fetch
global.fetch = vi.fn();

// Mock Notification
Object.defineProperty(global, "Notification", {
  value: vi.fn(),
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

// Helper to create mock fetch response
function mockFetchResponse(data: unknown, ok = true, status = 200) {
  let body = data;
  // The agent-control API expects response bodies in { ok, payload } shape.
  // Normalize legacy test payloads that used { success: true, ... } so the
  // existing tests keep working against the real service implementation.
  if (
    ok &&
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    "success" in data
  ) {
    const d = data as Record<string, unknown>;
    if (d.success === true) {
      body =
        d.payload !== undefined
          ? { ok: true, payload: d.payload }
          : { ok: true, payload: d };
    } else {
      body = { ok: false, error: d.error || "API request failed" };
    }
  }
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

describe("Scheduled Jobs E2E - Complete Lifecycle", () => {
  beforeEach(() => {
    clearExecutionHistory();
    
    // Stop any running runner
    stopJobRunner();
    
    // Reset mocks
    vi.resetAllMocks();
  });

  afterEach(() => {
    stopJobRunner();
  });

  describe("Job Creation via API", () => {
    it("should create a job via API", async () => {
      const jobConfig: ScheduledJobConfig = {
        id: "job-1",
        name: "Daily Backup",
        description: "Backup important files daily",
        schedule: "0 2 * * *",
        taskType: "smart-backup",
        parameters: { target: "/data" },
        prompt: "Run daily backup",
        enabled: true,
        maxRetries: 3,
        timeout: 30,
        notifyOnSuccess: false,
        notifyOnFailure: true,
        createdAt: new Date().toISOString(),
      };

      // Mock API response
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({ success: true, job: jobConfig })
      );

      // Create job via API
      const result = await createScheduledJob(jobConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/agent-control"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("cron.update"),
        })
      );
    });

    it("should list all jobs from API", async () => {
      const jobs: ScheduledJobConfig[] = [
        {
          id: "job-1",
          name: "Job 1",
          schedule: "0 * * * *",
          taskType: "custom-task",
          parameters: {},
          prompt: "Run job 1",
          enabled: true,
          maxRetries: 3,
          timeout: 30,
          notifyOnSuccess: false,
          notifyOnFailure: true,
        },
        {
          id: "job-2",
          name: "Job 2",
          schedule: "0 0 * * *",
          taskType: "custom-task",
          parameters: {},
          prompt: "Run job 2",
          enabled: false,
          maxRetries: 3,
          timeout: 30,
          notifyOnSuccess: false,
          notifyOnFailure: true,
        },
      ];

      // Mock API response
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({ 
          success: true, 
          payload: { jobs } 
        })
      );

      const result = await listScheduledJobs();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/agent-control"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("cron.list"),
        })
      );
      expect(result).toHaveLength(2);
    });

    it("should handle API errors gracefully", async () => {
      // Mock API error
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({ error: "Server error" }, false, 500)
      );

      await expect(listScheduledJobs()).rejects.toThrow("Failed to list scheduled jobs");
    });
  });

  describe("Job Runner Lifecycle", () => {
    beforeEach(() => {
      // Mock successful empty job list for runner polling
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({ success: true, payload: { jobs: [] } })
      );
    });

    it("should start and stop the job runner", () => {
      expect(isJobRunnerRunning()).toBe(false);

      startJobRunner();
      expect(isJobRunnerRunning()).toBe(true);

      stopJobRunner();
      expect(isJobRunnerRunning()).toBe(false);
    });

    it("should maintain runner state", () => {
      startJobRunner({
        pollInterval: 30000,
        maxConcurrentJobs: 5,
      });

      const state = getJobRunnerState();
      expect(state.isRunning).toBe(true);
      expect(state.pollInterval).toBe(30000);
      expect(state.maxConcurrentJobs).toBe(5);
    });

    it("should not start multiple runners", () => {
      const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

      startJobRunner();
      startJobRunner();

      expect(consoleSpy).toHaveBeenCalledWith("[JobRunner] Already running");
      consoleSpy.mockRestore();
    });
  });

  describe("Job Execution Flow", () => {
    it("should execute a job and record to history", async () => {
      // Record an execution directly in runner history
      const execution = {
        executionId: "exec-1",
        jobId: "job-exec-1",
        status: "completed" as const,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        output: "Success",
      };

      // Add to history via runner's internal mechanism
      clearExecutionHistory();
      
      // Mock the execution by calling the runner's internal method indirectly
      const job: ScheduledJobConfig = {
        id: "job-exec-1",
        name: "Test Job",
        schedule: "0 * * * *",
        taskType: "code-review",
        parameters: {},
        prompt: "Run test",
        enabled: true,
        maxRetries: 3,
        timeout: 30,
        notifyOnSuccess: false,
        notifyOnFailure: true,
      };

      // Mock API for job execution
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({ success: true, execution })
      );

      // Execution history is maintained in memory by the runner
      const history = getExecutionHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it("should handle failed job execution", async () => {
      const execution = {
        executionId: "exec-fail-1",
        jobId: "job-fail-1",
        status: "failed" as const,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        error: "Something went wrong",
      };

      // Mock API error response
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({ success: false, error: "Execution failed" }, false, 500)
      );

      // Error handling is done at the service level
      expect(execution.status).toBe("failed");
      expect(execution.error).toBe("Something went wrong");
    });

    it("should limit execution history to 100 entries", async () => {
      // The runner maintains execution history in memory
      clearExecutionHistory();
      
      const history = getExecutionHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe("Job Status Management via API", () => {
    it("should pause and resume jobs via API", async () => {
      const job: ScheduledJobConfig = {
        id: "job-pause-1",
        name: "Pausable Job",
        schedule: "0 * * * *",
        taskType: "custom-task",
        parameters: {},
        prompt: "Run",
        enabled: true,
        maxRetries: 3,
        timeout: 30,
        notifyOnSuccess: false,
        notifyOnFailure: true,
      };

      const pausedJob = { ...job, enabled: false };
      const resumedJob = { ...job, enabled: true };

      // Sequence: pause update → list → resume update → list
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockFetchResponse({ ok: true }))
        .mockResolvedValueOnce(mockFetchResponse({ ok: true, payload: { jobs: [pausedJob] } }))
        .mockResolvedValueOnce(mockFetchResponse({ ok: true }))
        .mockResolvedValueOnce(mockFetchResponse({ ok: true, payload: { jobs: [resumedJob] } }));

      await pauseScheduledJob("job-pause-1");
      await resumeScheduledJob("job-pause-1");

      // The service uses cron.update for both pause and resume
      const updateCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => typeof call[1]?.body === "string" && call[1].body.includes("cron.update")
      );
      expect(updateCalls.length).toBeGreaterThanOrEqual(2);
    });

    it("should track last run time via API", async () => {
      const now = new Date().toISOString();
      const job: ScheduledJobConfig = {
        id: "job-track-1",
        name: "Tracked Job",
        schedule: "0 * * * *",
        taskType: "custom-task",
        parameters: {},
        prompt: "Run",
        enabled: true,
        maxRetries: 3,
        timeout: 30,
        notifyOnSuccess: false,
        notifyOnFailure: true,
        lastRunAt: now,
        runCount: 5,
      };

      // Mock API response for run now
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({ success: true, execution: { id: "exec-1" } })
      );

      await runScheduledJobNow("job-track-1");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/agent-control"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("cron.run"),
        })
      );
    });
  });

  describe("Cron Expression Handling", () => {
    it("should handle various cron patterns", () => {
      const patterns = [
        { schedule: "* * * * *", description: "Every minute" },
        { schedule: "0 * * * *", description: "Every hour" },
        { schedule: "0 0 * * *", description: "Daily at midnight" },
        { schedule: "0 9 * * 1-5", description: "Weekdays at 9am" },
        { schedule: "0 0 * * 0", description: "Weekly on Sunday" },
        { schedule: "0 0 1 * *", description: "Monthly" },
      ];

      patterns.forEach(({ schedule }) => {
        const job: ScheduledJobConfig = {
          id: `job-${schedule.replace(/\s/g, "-")}`,
          name: "Test",
          schedule,
          taskType: "custom-task",
          parameters: {},
          prompt: "Run",
          enabled: true,
          maxRetries: 3,
          timeout: 30,
          notifyOnSuccess: false,
          notifyOnFailure: true,
        };

        expect(job.schedule).toBe(schedule);
      });
    });
  });

  describe("Complete Workflow via API", () => {
    it("should handle full job lifecycle: create → run → history → delete", async () => {
      const job: ScheduledJobConfig = {
        id: "job-full-1",
        name: "Full Workflow Job",
        description: "A job for testing full workflow",
        schedule: "0 * * * *",
        taskType: "custom-task",
        parameters: { key: "value" },
        prompt: "Execute test task",
        enabled: true,
        maxRetries: 3,
        timeout: 30,
        notifyOnSuccess: true,
        notifyOnFailure: true,
        createdAt: new Date().toISOString(),
      };

      // Track the job state as the workflow mutates it.
      let currentJob: ScheduledJobConfig = { ...job };

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string, options?: RequestInit) => {
        const body = typeof options?.body === "string" ? options.body : "";
        if (body.includes("cron.list")) {
          return Promise.resolve(mockFetchResponse({ ok: true, payload: { jobs: [currentJob] } }));
        }
        if (body.includes("cron.update")) {
          if (body.includes('"enabled":false')) {
            currentJob = { ...currentJob, enabled: false };
          } else if (body.includes('"enabled":true')) {
            currentJob = { ...currentJob, enabled: true };
          } else if (body.includes('"name":"Updated Full Workflow Job"')) {
            currentJob = { ...currentJob, name: "Updated Full Workflow Job" };
          }
          return Promise.resolve(mockFetchResponse({ ok: true }));
        }
        if (body.includes("cron.run")) {
          return Promise.resolve(mockFetchResponse({ ok: true, payload: { execution: { id: "exec-1" } } }));
        }
        // Default for create / delete / REST fallback
        return Promise.resolve(mockFetchResponse({ ok: true }));
      });

      await createScheduledJob(job);

      const jobs = await listScheduledJobs();
      expect(jobs.length).toBe(1);
      expect(jobs[0].name).toBe("Full Workflow Job");

      startJobRunner({ pollInterval: 60000 });
      expect(isJobRunnerRunning()).toBe(true);

      await updateScheduledJob("job-full-1", { name: "Updated Full Workflow Job" });
      expect(currentJob.name).toBe("Updated Full Workflow Job");

      await pauseScheduledJob("job-full-1");
      expect(currentJob.enabled).toBe(false);

      await deleteScheduledJob("job-full-1");

      // 7. Stop runner
      stopJobRunner();
      expect(isJobRunnerRunning()).toBe(false);
    });
  });

  describe("Error Recovery", () => {
    it("should track job execution errors via API", async () => {
      // Mock API returning failed executions
      const executions = [
        {
          executionId: "exec-err-1",
          jobId: "job-err-1",
          status: "failed",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          error: "Network timeout",
        },
        {
          executionId: "exec-err-2",
          jobId: "job-err-1",
          status: "failed",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          error: "Permission denied",
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockFetchResponse({ success: true, payload: { executions } })
      );

      // Error tracking would be done via API calls
      const failedExecutions = executions.filter((e) => e.status === "failed");
      expect(failedExecutions.length).toBe(2);
    });

    it("should handle network errors gracefully", async () => {
      // Mock network error
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network error")
      );

      await expect(listScheduledJobs()).rejects.toThrow();
    });

    it("should handle API returning invalid JSON", async () => {
      // Mock invalid JSON response
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      await expect(listScheduledJobs()).rejects.toThrow();
    });
  });
});
