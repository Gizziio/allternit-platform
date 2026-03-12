/**
 * Integration Tests for Cron Service
 * 
 * Comprehensive test suite covering all functionality.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { CronServiceEnhanced } from "../service-enhanced";
import { CronDatabase } from "../database";
import { parseSchedule, describeSchedule } from "../parser";
import { calculateNextRun, isValidTimezone, COMMON_TIMEZONES } from "../utils/timezone";
import { withRetry, RetryableErrors, calculateDelay } from "../utils/retry";
import type { CreateJobInput } from "../types";

const TEST_DB = join(tmpdir(), `cron-test-${Date.now()}.db`);

describe("Cron Service Integration", () => {
  beforeAll(() => {
    // Clean up any existing test DB
    if (existsSync(TEST_DB)) {
      unlinkSync(TEST_DB);
    }
  });

  afterAll(() => {
    // Clean up test DB
    if (existsSync(TEST_DB)) {
      unlinkSync(TEST_DB);
    }
  });

  beforeEach(() => {
    // Reset service state
    if (CronServiceEnhanced.isRunning()) {
      CronServiceEnhanced.close();
    }
  });

  describe("Service Lifecycle", () => {
    it("should initialize with database", () => {
      CronServiceEnhanced.initialize({
        dbPath: TEST_DB,
        timezone: "UTC",
      });

      expect(CronServiceEnhanced.isRunning()).toBe(false);
      
      // Clean up
      CronServiceEnhanced.close();
    });

    it("should start and stop the scheduler", async () => {
      CronServiceEnhanced.initialize({
        dbPath: TEST_DB,
        checkIntervalMs: 1000,
      });

      CronServiceEnhanced.start();
      expect(CronServiceEnhanced.isRunning()).toBe(true);

      await CronServiceEnhanced.stop();
      expect(CronServiceEnhanced.isRunning()).toBe(false);
    });

    it("should perform graceful shutdown", async () => {
      CronServiceEnhanced.initialize({
        dbPath: TEST_DB,
      });
      CronServiceEnhanced.start();

      const shutdownStart = Date.now();
      await CronServiceEnhanced.stop({ force: false, timeoutMs: 5000 });
      const shutdownDuration = Date.now() - shutdownStart;

      expect(shutdownDuration).toBeLessThan(6000);
      expect(CronServiceEnhanced.isRunning()).toBe(false);
    });
  });

  describe("Job CRUD Operations", () => {
    beforeEach(() => {
      CronServiceEnhanced.initialize({ dbPath: TEST_DB });
    });

    afterEach(() => {
      CronServiceEnhanced.close();
    });

    it("should create a job with cron schedule", () => {
      const job = CronServiceEnhanced.create({
        name: "Test Job",
        type: "shell",
        schedule: "0 9 * * *",
        config: { command: "echo hello" },
      });

      expect(job.id).toBeDefined();
      expect(job.name).toBe("Test Job");
      expect(job.type).toBe("shell");
      expect(job.status).toBe("active");
      expect(job.nextRunAt).toBeDefined();
    });

    it("should create a job with interval schedule", () => {
      const job = CronServiceEnhanced.create({
        name: "Interval Job",
        type: "shell",
        schedule: { type: "interval", seconds: 300 },
        config: { command: "echo hello" },
      });

      expect(job.schedule.type).toBe("interval");
      expect((job.schedule as { seconds: number }).seconds).toBe(300);
    });

    it("should retrieve a job by ID", () => {
      const created = CronServiceEnhanced.create({
        name: "Retrievable Job",
        type: "shell",
        schedule: "0 9 * * *",
        config: { command: "echo hello" },
      });

      const retrieved = CronServiceEnhanced.get(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe("Retrievable Job");
    });

    it("should list all jobs", () => {
      CronServiceEnhanced.create({
        name: "Job 1",
        type: "shell",
        schedule: "0 9 * * *",
        config: { command: "echo 1" },
      });

      CronServiceEnhanced.create({
        name: "Job 2",
        type: "shell",
        schedule: "0 10 * * *",
        config: { command: "echo 2" },
      });

      const jobs = CronServiceEnhanced.list();
      expect(jobs.length).toBeGreaterThanOrEqual(2);
    });

    it("should update a job", () => {
      const job = CronServiceEnhanced.create({
        name: "Updatable Job",
        type: "shell",
        schedule: "0 9 * * *",
        config: { command: "echo hello" },
      });

      const updated = CronServiceEnhanced.update(job.id, {
        name: "Updated Job",
        status: "paused",
      });

      expect(updated.name).toBe("Updated Job");
      expect(updated.status).toBe("paused");
    });

    it("should pause and resume a job", () => {
      const job = CronServiceEnhanced.create({
        name: "Pausable Job",
        type: "shell",
        schedule: "0 9 * * *",
        config: { command: "echo hello" },
      });

      const paused = CronServiceEnhanced.pause(job.id);
      expect(paused.status).toBe("paused");

      const resumed = CronServiceEnhanced.resume(job.id);
      expect(resumed.status).toBe("active");
    });

    it("should delete a job", () => {
      const job = CronServiceEnhanced.create({
        name: "Deletable Job",
        type: "shell",
        schedule: "0 9 * * *",
        config: { command: "echo hello" },
      });

      const deleted = CronServiceEnhanced.delete(job.id);
      expect(deleted).toBe(true);

      const retrieved = CronServiceEnhanced.get(job.id);
      expect(retrieved).toBeNull();
    });
  });

  describe("Schedule Parser", () => {
    it("should parse natural language schedules", () => {
      const tests = [
        { input: "every 5 minutes", expected: "*/5 * * * *" },
        { input: "every hour", expected: "0 * * * *" },
        { input: "daily at 9am", expected: "0 9 * * *" },
        { input: "daily at noon", expected: "0 12 * * *" },
        { input: "weekdays at 9am", expected: "0 9 * * 1-5" },
      ];

      for (const test of tests) {
        const parsed = parseSchedule(test.input);
        expect(parsed).toBeDefined();
        expect(parsed?.expression).toBe(test.expected);
      }
    });

    it("should describe schedules in human-readable format", () => {
      const tests = [
        { expr: "*/5 * * * *", expected: "Every 5 minutes" },
        { expr: "0 9 * * *", expected: "Daily at 9:00 AM" },
        { expr: "0 9 * * 1-5", expected: "Weekdays at 9:00 AM" },
      ];

      for (const test of tests) {
        const desc = describeSchedule({ type: "cron", expression: test.expr });
        expect(desc).toBe(test.expected);
      }
    });
  });

  describe("Timezone Support", () => {
    it("should validate timezones", () => {
      expect(isValidTimezone("UTC")).toBe(true);
      expect(isValidTimezone("America/New_York")).toBe(true);
      expect(isValidTimezone("Europe/London")).toBe(true);
      expect(isValidTimezone("Invalid/Timezone")).toBe(false);
    });

    it("should calculate next run in different timezones", () => {
      const expr = "0 9 * * *"; // 9 AM daily
      
      const nyNext = calculateNextRun(expr, "America/New_York", new Date("2024-01-01T00:00:00Z"));
      const londonNext = calculateNextRun(expr, "Europe/London", new Date("2024-01-01T00:00:00Z"));
      
      // Times should be different in different timezones
      expect(nyNext.getTime()).not.toBe(londonNext.getTime());
    });

    it("should have common timezones defined", () => {
      expect(COMMON_TIMEZONES.length).toBeGreaterThan(0);
      expect(COMMON_TIMEZONES.some((tz) => tz.value === "UTC")).toBe(true);
      expect(COMMON_TIMEZONES.some((tz) => tz.value === "America/New_York")).toBe(true);
    });
  });

  describe("Retry Logic", () => {
    it("should calculate exponential backoff delays", () => {
      const config = {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 60000,
        backoffMultiplier: 2,
        exponential: true,
      };

      const delay1 = calculateDelay(1, config);
      const delay2 = calculateDelay(2, config);
      const delay3 = calculateDelay(3, config);

      // Each delay should be roughly 2x the previous
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it("should retry on failure", async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("Temporary error");
        }
        return "success";
      };

      const result = await withRetry(operation, {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2,
        exponential: true,
      });

      expect(result).toBe("success");
      expect(attempts).toBe(3);
    });

    it("should not retry non-retryable errors", async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new Error("401 Unauthorized");
      };

      try {
        await withRetry(operation, {
          maxAttempts: 3,
          initialDelayMs: 10,
          isRetryable: RetryableErrors.standard,
        });
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(attempts).toBe(1); // Should not retry
      }
    });
  });

  describe("Job Execution", () => {
    beforeEach(() => {
      CronServiceEnhanced.initialize({
        dbPath: TEST_DB,
        checkIntervalMs: 100,
        defaultTimeoutSeconds: 5,
      });
      CronServiceEnhanced.start();
    });

    afterEach(async () => {
      await CronServiceEnhanced.stop({ force: true });
    });

    it("should execute a shell job", async () => {
      const job = CronServiceEnhanced.create({
        name: "Shell Test",
        type: "shell",
        schedule: "* * * * *",
        config: { command: "echo 'test output'" },
      });

      const run = await CronServiceEnhanced.run(job.id);

      expect(run.status).toBe("success");
      expect(run.output).toContain("test output");
      expect(run.exitCode).toBe(0);
    });

    it("should handle shell job failures", async () => {
      const job = CronServiceEnhanced.create({
        name: "Failing Shell",
        type: "shell",
        schedule: "* * * * *",
        config: { command: "exit 1" },
      });

      const run = await CronServiceEnhanced.run(job.id);

      expect(run.status).toBe("failed");
      expect(run.exitCode).toBe(1);
    });

    it("should execute an HTTP job", async () => {
      // Create a simple test server
      const server = Bun.serve({
        port: 0,
        fetch: () => new Response('{"status": "ok"}'),
      });

      try {
        const job = CronServiceEnhanced.create({
          name: "HTTP Test",
          type: "http",
          schedule: "* * * * *",
          config: {
            url: `http://localhost:${server.port}/health`,
            method: "GET",
          },
        });

        const run = await CronServiceEnhanced.run(job.id);

        expect(run.status).toBe("success");
        expect(run.httpStatus).toBe(200);
        expect(run.output).toContain("ok");
      } finally {
        server.stop();
      }
    });

    it("should enforce job timeouts", async () => {
      const job = CronServiceEnhanced.create({
        name: "Timeout Test",
        type: "shell",
        schedule: "* * * * *",
        timeoutSeconds: 1,
        config: { command: "sleep 10" },
      });

      const run = await CronServiceEnhanced.run(job.id);

      expect(run.status).toBe("failed");
      expect(run.durationMs).toBeLessThan(5000); // Should timeout quickly
    });

    it("should track run history", async () => {
      const job = CronServiceEnhanced.create({
        name: "History Test",
        type: "shell",
        schedule: "* * * * *",
        config: { command: "echo test" },
      });

      // Run the job twice
      await CronServiceEnhanced.run(job.id);
      await CronServiceEnhanced.run(job.id);

      const runs = CronServiceEnhanced.getRuns(job.id);
      expect(runs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Event System", () => {
    beforeEach(() => {
      CronServiceEnhanced.initialize({ dbPath: TEST_DB });
    });

    afterEach(() => {
      CronServiceEnhanced.close();
    });

    it("should emit events on job creation", () => {
      const events: string[] = [];
      const unsubscribe = CronServiceEnhanced.onEvent((event) => {
        events.push(event.type);
      });

      CronServiceEnhanced.create({
        name: "Event Test",
        type: "shell",
        schedule: "0 9 * * *",
        config: { command: "echo hello" },
      });

      expect(events).toContain("job:created");

      unsubscribe();
    });

    it("should emit events on job status changes", () => {
      const events: string[] = [];
      const unsubscribe = CronServiceEnhanced.onEvent((event) => {
        events.push(event.type);
      });

      const job = CronServiceEnhanced.create({
        name: "Status Event Test",
        type: "shell",
        schedule: "0 9 * * *",
        config: { command: "echo hello" },
      });

      CronServiceEnhanced.pause(job.id);
      expect(events).toContain("job:paused");

      CronServiceEnhanced.resume(job.id);
      expect(events).toContain("job:resumed");

      unsubscribe();
    });
  });

  describe("Metrics", () => {
    beforeEach(() => {
      CronServiceEnhanced.initialize({ dbPath: TEST_DB });
    });

    afterEach(() => {
      CronServiceEnhanced.close();
    });

    it("should provide service status", () => {
      const status = CronServiceEnhanced.getStatus();

      expect(status.jobs).toBeDefined();
      expect(status.runs).toBeDefined();
      expect(status.version).toBeDefined();
    });

    it("should track metrics", () => {
      const initialMetrics = CronServiceEnhanced.getMetrics();
      expect(initialMetrics.jobsStarted).toBe(0);
    });
  });

  describe("Database", () => {
    let db: CronDatabase;

    beforeEach(() => {
      if (existsSync(TEST_DB)) {
        unlinkSync(TEST_DB);
      }
      db = new CronDatabase(TEST_DB);
    });

    afterEach(() => {
      db.close();
      if (existsSync(TEST_DB)) {
        unlinkSync(TEST_DB);
      }
    });

    it("should persist jobs to database", () => {
      const job = {
        id: "test-job-1",
        name: "Test Job",
        type: "shell" as const,
        status: "active" as const,
        schedule: { type: "cron" as const, expression: "0 9 * * *" },
        config: { command: "echo hello" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        runCount: 0,
        failCount: 0,
        tags: [],
        metadata: {},
      };

      db.saveJob(job);
      const retrieved = db.getJob("test-job-1");

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("Test Job");
    });

    it("should persist runs to database", () => {
      const run = {
        id: "test-run-1",
        jobId: "test-job-1",
        status: "success" as const,
        scheduledAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 1000,
        attempt: 1,
        triggeredBy: "manual" as const,
        output: "test output",
        metadata: {},
      };

      db.saveRun(run);
      const retrieved = db.getRun("test-run-1");

      expect(retrieved).toBeDefined();
      expect(retrieved?.status).toBe("success");
    });

    it("should support log rotation", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const run = {
        id: "old-run",
        jobId: "test-job",
        status: "success" as const,
        scheduledAt: oldDate.toISOString(),
        attempt: 1,
        triggeredBy: "schedule" as const,
        metadata: {},
      };

      db.saveRun(run);
      
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const deleted = db.deleteOldRuns(cutoff.toISOString());

      expect(deleted).toBeGreaterThan(0);
      expect(db.getRun("old-run")).toBeNull();
    });

    it("should report database size", () => {
      const size = db.getDatabaseSize();
      expect(typeof size).toBe("number");
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });
});

// Run the tests
console.log("Running Cron Service Integration Tests...");
