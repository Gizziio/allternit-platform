/**
 * Integration Tests for Desktop VM Manager
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { DesktopVMManager } from "../../../6-ui/desktop/src/vm/manager";
import { MockVMDriver } from "../mocks/vm-driver";

const TEST_DATA_DIR = join(tmpdir(), `cowork-integration-test-${Date.now()}`);

describe("DesktopVMManager Integration", () => {
  let manager: DesktopVMManager;

  beforeEach(() => {
    if (!existsSync(TEST_DATA_DIR)) {
      mkdirSync(TEST_DATA_DIR, { recursive: true });
    }

    // Create manager with mock driver
    manager = new DesktopVMManager({
      dataDir: TEST_DATA_DIR,
      socketPath: join(TEST_DATA_DIR, "test.sock"),
    });

    // Inject mock driver
    (manager as any).driver = new MockVMDriver({ simulateDelay: 10 });
  });

  afterEach(async () => {
    try {
      await manager.destroyVM();
    } catch {
      // Ignore cleanup errors
    }

    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  });

  describe("Lifecycle", () => {
    it("should initialize successfully", async () => {
      await manager.initialize();

      const status = manager.getStatus();
      expect(status.state).toBe("uninitialized");
      expect(status.lifecycleState).toBe("uninitialized");
    });

    it("should complete full VM lifecycle", async () => {
      // Initialize
      await manager.initialize();
      expect(manager.getStatus().state).toBe("uninitialized");

      // Start VM
      await manager.startVM({
        cpuCount: 2,
        memorySize: 1024 * 1024 * 1024,
      });

      expect(manager.getStatus().state).toBe("running");
      expect(manager.getStatus().vm).toBeDefined();

      // Execute command
      const result = await manager.execute("echo hello");
      expect(result.stdout).toContain("hello");
      expect(result.exitCode).toBe(0);

      // Stop VM
      await manager.stopVM();
      expect(manager.getStatus().state).toBe("stopped");
    });

    it("should restart VM", async () => {
      await manager.initialize();
      await manager.startVM();

      expect(manager.getStatus().state).toBe("running");

      await manager.restartVM();

      expect(manager.getStatus().state).toBe("running");
    });

    it("should handle concurrent operations safely", async () => {
      await manager.initialize();
      await manager.startVM();

      // Execute multiple commands concurrently
      const results = await Promise.all([
        manager.execute("echo 1"),
        manager.execute("echo 2"),
        manager.execute("echo 3"),
      ]);

      expect(results.length).toBe(3);
      results.forEach((result) => {
        expect(result.exitCode).toBe(0);
      });
    });
  });

  describe("Health Monitoring", () => {
    it("should start health monitoring with VM", async () => {
      await manager.initialize();
      await manager.startVM();

      const health = (manager as any).healthMonitor;
      expect(health).toBeDefined();
      expect(health.isRunning()).toBe(true);
    });

    it("should detect healthy VM", async () => {
      await manager.initialize();
      await manager.startVM();

      // Wait a bit for health check
      await new Promise((r) => setTimeout(r, 100));

      const status = manager.getHealthStatus();
      expect(status).toBeDefined();
    });
  });

  describe("Socket Server", () => {
    it("should start socket server with VM", async () => {
      await manager.initialize();
      await manager.startVM();

      const server = (manager as any).socketServer;
      expect(server).toBeDefined();
    });

    it("should stop socket server with VM", async () => {
      await manager.initialize();
      await manager.startVM();

      const server = (manager as any).socketServer;
      expect(server.isRunning()).toBe(true);

      await manager.stopVM();

      expect(server.isRunning()).toBe(false);
    });
  });

  describe("Events", () => {
    it("should emit lifecycle events", async () => {
      const events: string[] = [];

      manager.on("vm:starting", () => events.push("starting"));
      manager.on("vm:started", () => events.push("started"));
      manager.on("vm:stopping", () => events.push("stopping"));
      manager.on("vm:stopped", () => events.push("stopped"));

      await manager.initialize();
      await manager.startVM();
      await manager.stopVM();

      expect(events).toContain("starting");
      expect(events).toContain("started");
      expect(events).toContain("stopping");
      expect(events).toContain("stopped");
    });

    it("should emit state change events", async () => {
      const stateChanges: Array<{ from: string; to: string }> = [];

      manager.on("state:changed", (data) => {
        stateChanges.push({ from: data.from, to: data.to });
      });

      await manager.initialize();
      await manager.startVM();
      await manager.stopVM();

      expect(stateChanges.length).toBeGreaterThan(0);
      expect(stateChanges[0].from).toBe("uninitialized");
      expect(stateChanges[0].to).toBe("initializing");
    });
  });

  describe("Error Handling", () => {
    it("should handle start failure gracefully", async () => {
      await manager.initialize();

      // Inject failing driver
      (manager as any).driver = new MockVMDriver({ shouldFailStart: true });

      await expect(manager.startVM()).rejects.toThrow();

      expect(manager.getStatus().state).toBe("error");
    });

    it("should handle command execution failure", async () => {
      await manager.initialize();
      await manager.startVM();

      // Commands with "fail" in them return exit code 1 in mock
      const result = await manager.execute("this will fail");

      expect(result.exitCode).toBe(1);
    });

    it("should recover from errors", async () => {
      await manager.initialize();

      // First start fails
      (manager as any).driver = new MockVMDriver({ shouldFailStart: true });
      await expect(manager.startVM()).rejects.toThrow();

      // Replace with working driver
      (manager as any).driver = new MockVMDriver({ simulateDelay: 10 });

      // Should be able to start now
      await manager.startVM();
      expect(manager.getStatus().state).toBe("running");
    });
  });

  describe("Configuration", () => {
    it("should use custom configuration", async () => {
      const customManager = new DesktopVMManager({
        dataDir: TEST_DATA_DIR,
        socketPath: join(TEST_DATA_DIR, "custom.sock"),
        checkIntervalMs: 5000,
        maxHealthCheckFailures: 5,
        autoRestart: false,
      });

      expect((customManager as any).options.checkIntervalMs).toBe(5000);
      expect((customManager as any).options.maxHealthCheckFailures).toBe(5);
      expect((customManager as any).options.autoRestart).toBe(false);
    });
  });
});

// Run tests
console.log("Running DesktopVMManager integration tests...");
