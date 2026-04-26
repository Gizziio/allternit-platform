/**
 * E2E Test - Full Cowork Runtime System
 * 
 * This test demonstrates the complete system working together.
 * Run with: bun test tests/e2e/full-system.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Import all components
import { VMImageManager } from "../../images/manager";
import { MockVMDriver } from "../mocks/vm-driver";
import { DesktopVMManager } from "../../../6-ui/desktop/src/vm/manager";
import { FileSync } from "../../sync/sync";
import { SessionManager } from "../../sessions/manager";
import { ConflictStrategy } from "../../sync/conflict";

const TEST_DIR = join(tmpdir(), `cowork-e2e-${Date.now()}`);

describe("Cowork Runtime E2E", () => {
  let imageManager: VMImageManager;
  let vmManager: DesktopVMManager;
  let fileSync: FileSync;
  let sessionManager: SessionManager;

  beforeAll(async () => {
    // Setup test environment
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }

    console.log(`\n🧪 E2E Test Environment: ${TEST_DIR}\n`);
  });

  afterAll(async () => {
    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should complete full workflow: image → VM → sync → session", async () => {
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Image Management
    // ═══════════════════════════════════════════════════════════════════════
    console.log("📦 Step 1: Image Management");

    const imageCacheDir = join(TEST_DIR, "images");
    mkdirSync(imageCacheDir, { recursive: true });

    imageManager = new VMImageManager({
      cacheDir: imageCacheDir,
    });

    // Create a mock image for testing
    const mockImageVersion = "1.0.0";
    const mockArch = "arm64";

    // Create mock image files
    const kernelPath = join(imageCacheDir, `vmlinux-6.5.0-allternit-${mockArch}`);
    const initrdPath = join(imageCacheDir, `initrd.img-6.5.0-allternit-${mockArch}`);
    const rootfsPath = join(
      imageCacheDir,
      `ubuntu-22.04-allternit-v${mockImageVersion}.${mockArch}.ext4.zst`
    );

    // Write dummy files
    await Bun.write(kernelPath, "mock kernel");
    await Bun.write(initrdPath, "mock initrd");
    await Bun.write(rootfsPath, "mock rootfs");

    // Create metadata
    await Bun.write(
      join(imageCacheDir, `version-${mockImageVersion}-${mockArch}.json`),
      JSON.stringify({
        version: mockImageVersion,
        architecture: mockArch,
        kernel: `vmlinux-6.5.0-allternit-${mockArch}`,
        initrd: `initrd.img-6.5.0-allternit-${mockArch}`,
        rootfs: `ubuntu-22.04-allternit-v${mockImageVersion}.${mockArch}.ext4.zst`,
        checksums: {},
        size: {},
        createdAt: new Date().toISOString(),
      })
    );

    const image = imageManager.getImage(mockImageVersion, mockArch);
    expect(image).not.toBeNull();
    expect(image?.version).toBe(mockImageVersion);
    expect(image?.architecture).toBe(mockArch);
    expect(existsSync(image!.kernelPath)).toBe(true);

    console.log("   ✅ Image created and cached\n");

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: VM Management
    // ═══════════════════════════════════════════════════════════════════════
    console.log("🖥️  Step 2: VM Management");

    const vmDataDir = join(TEST_DIR, "vm-data");
    const socketPath = join(TEST_DIR, "vm.sock");

    vmManager = new DesktopVMManager({
      dataDir: vmDataDir,
      socketPath,
    });

    // Inject mock driver for testing
    const mockDriver = new MockVMDriver({ simulateDelay: 50 });
    (vmManager as any).driver = mockDriver;

    await vmManager.initialize();
    expect(vmManager.getStatus().state).toBe("uninitialized");

    await vmManager.startVM({
      cpuCount: 2,
      memorySize: 1024 * 1024 * 1024,
    });

    expect(vmManager.getStatus().state).toBe("running");

    // Execute command
    const result = await vmManager.execute("echo 'Hello from VM'");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Hello from VM");

    console.log("   ✅ VM started and executing commands\n");

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: File Sync
    // ═══════════════════════════════════════════════════════════════════════
    console.log("📁 Step 3: File Sync");

    // Create host workspace
    const hostWorkspace = join(TEST_DIR, "workspace");
    mkdirSync(hostWorkspace, { recursive: true });
    await Bun.write(join(hostWorkspace, "package.json"), '{"name":"test"}');
    await Bun.write(join(hostWorkspace, "README.md"), "# Test Project");

    // Create VM workspace
    const vmWorkspace = join(TEST_DIR, "vm-workspace");
    mkdirSync(vmWorkspace, { recursive: true });

    // Setup file sync (mock protocol client)
    const mockProtocolClient = {
      execute: async (request: any) => ({
        exitCode: 0,
        stdout: Buffer.from("synced").toString("base64"),
        stderr: "",
        duration: 100,
      }),
    };

    fileSync = new FileSync({
      protocolClient: mockProtocolClient as any,
      strategy: ConflictStrategy.NEWEST_WINS,
    });

    await fileSync.addMapping({
      hostPath: hostWorkspace,
      vmPath: vmWorkspace,
      direction: "bidirectional",
      exclude: ["node_modules", ".git"],
      watch: false,
    });

    // Perform sync
    const syncResult = await fileSync.syncOnce({
      hostPath: hostWorkspace,
      vmPath: vmWorkspace,
      direction: "bidirectional",
    });

    expect(syncResult.success).toBe(true);

    console.log("   ✅ File sync configured\n");

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: Session Management
    // ═══════════════════════════════════════════════════════════════════════
    console.log("🔧 Step 4: Session Management");

    // Create session manager with mock VM
    const mockVM = {
      id: "test-vm",
      name: "Test VM",
      status: "running",
      config: {},
    };

    sessionManager = new SessionManager(mockVM as any, mockProtocolClient as any);

    // Create session
    const session = await sessionManager.createSession({
      cwd: "/workspace",
      env: { NODE_ENV: "test" },
      limits: {
        cpu: { cores: 1, percent: 50 },
        memory: { limit: 512 * 1024 * 1024 },
      },
    });

    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(await session.getCwd()).toBe("/workspace");
    expect(await session.getEnv("NODE_ENV")).toBe("test");

    // Execute in session
    const sessionResult = await session.execute({
      command: "printenv NODE_ENV",
    });

    expect(sessionResult.exitCode).toBe(0);

    // Fork session
    const forkedSession = await sessionManager.forkSession(session.id, {
      isolation: "lightweight",
    });

    expect(forkedSession).toBeDefined();
    expect(forkedSession.id).not.toBe(session.id);

    // List sessions
    const sessions = await sessionManager.listSessions();
    expect(sessions.length).toBe(2);

    console.log("   ✅ Sessions created and managed\n");

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 5: Cleanup
    // ═══════════════════════════════════════════════════════════════════════
    console.log("🧹 Step 5: Cleanup");

    // Destroy sessions
    await sessionManager.destroySession(session.id);
    await sessionManager.destroySession(forkedSession.id);

    // Stop VM
    await vmManager.stopVM();
    expect(vmManager.getStatus().state).toBe("stopped");

    // Stop file sync
    await fileSync.stopWatching();

    console.log("   ✅ Cleanup complete\n");

    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║              ✅ E2E TEST PASSED                         ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");
  });

  it("should handle concurrent VM operations", async () => {
    const vmDataDir = join(TEST_DIR, "concurrent-vm");
    const socketPath = join(TEST_DIR, "concurrent.sock");

    const manager = new DesktopVMManager({
      dataDir: vmDataDir,
      socketPath,
    });

    (manager as any).driver = new MockVMDriver({ simulateDelay: 20 });

    await manager.initialize();
    await manager.startVM();

    // Execute multiple commands concurrently
    const commands = [
      "echo command1",
      "echo command2",
      "echo command3",
      "echo command4",
      "echo command5",
    ];

    const results = await Promise.all(
      commands.map((cmd) => manager.execute(cmd))
    );

    expect(results.length).toBe(5);
    results.forEach((result, i) => {
      expect(result.exitCode).toBe(0);
    });

    await manager.stopVM();
  });

  it("should recover from failures", async () => {
    const vmDataDir = join(TEST_DIR, "recovery-vm");
    const socketPath = join(TEST_DIR, "recovery.sock");

    const manager = new DesktopVMManager({
      dataDir: vmDataDir,
      socketPath,
    });

    // Start with failing driver
    (manager as any).driver = new MockVMDriver({ shouldFailStart: true });

    await manager.initialize();

    // Should fail
    await expect(manager.startVM()).rejects.toThrow();
    expect(manager.getStatus().state).toBe("error");

    // Switch to working driver
    (manager as any).driver = new MockVMDriver({ simulateDelay: 10 });

    // Should recover
    await manager.startVM();
    expect(manager.getStatus().state).toBe("running");

    // Execute should work
    const result = await manager.execute("echo recovered");
    expect(result.exitCode).toBe(0);

    await manager.stopVM();
  });
});

// Run tests
console.log("\n🚀 Starting Cowork Runtime E2E Tests\n");
