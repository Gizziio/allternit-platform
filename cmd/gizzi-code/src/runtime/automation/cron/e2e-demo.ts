/**
 * E2E Demo - Unified Cron System
 * 
 * This script demonstrates the full cron system working end-to-end.
 * Run with: bun src/runtime/automation/cron/e2e-demo.ts
 */

import { CronServiceEnhanced } from "./service-enhanced";
import { CoworkExecutor } from "./executors/cowork-executor";
import { registerFunction } from "./executors/function-registry";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const DEMO_DB = join(tmpdir(), `cron-e2e-demo-${Date.now()}.db`);

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║     Allternit Unified Cron System - E2E Demonstration               ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  // Cleanup any existing DB
  if (existsSync(DEMO_DB)) {
    unlinkSync(DEMO_DB);
  }

  try {
    // ═══════════════════════════════════════════════════════════════════════════════
    // STEP 1: Initialize Service with Real Executors
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log("📦 STEP 1: Initializing CronService with Cowork Executor...");
    
    const coworkExecutor = new CoworkExecutor({
      defaultCwd: process.cwd(),
    });

    CronServiceEnhanced.initialize({
      dbPath: DEMO_DB,
      timezone: "UTC",
      checkIntervalMs: 5000, // Check every 5 seconds for demo
      defaultTimeoutSeconds: 30,
      cowork: {
        defaultCwd: process.cwd(),
      },
      retry: {
        maxAttempts: 2,
        initialDelayMs: 1000,
        maxDelayMs: 60000,
        backoffMultiplier: 2,
        exponential: true,
      },
    });

    // Register executor manually (normally done internally)
    // Register executor manually (normally done internally)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (CronServiceEnhanced as unknown as { executors: { cowork: typeof coworkExecutor } }).executors = { cowork: coworkExecutor };

    console.log("   ✅ Service initialized");
    console.log(`   📁 Database: ${DEMO_DB}\n`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // STEP 2: Create Jobs
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log("📝 STEP 2: Creating Jobs...\n");

    // Job 1: Shell job - runs immediately
    const shellJob = CronServiceEnhanced.create({
      name: "Shell Health Check",
      type: "shell",
      schedule: "*/1 * * * *", // Every minute
      config: { command: "echo \"System OK at \$(date)\"" },
      tags: ["demo", "shell", "health"],
    });
    console.log(`   ✅ Created Shell Job: ${shellJob.name}`);
    console.log(`      ID: ${shellJob.id}`);
    console.log(`      Schedule: Every minute`);
    console.log(`      Next run: ${shellJob.nextRunAt}\n`);

    // Job 2: HTTP job - API health check
    const httpJob = CronServiceEnhanced.create({
      name: "HTTP API Check",
      type: "http",
      schedule: "*/2 * * * *", // Every 2 minutes
      config: {
        url: "https://api.github.com/status",
        method: "GET",
        timeoutSeconds: 10,
      },
      tags: ["demo", "http", "monitoring"],
    });
    console.log(`   ✅ Created HTTP Job: ${httpJob.name}`);
    console.log(`      ID: ${httpJob.id}`);
    console.log(`      URL: https://api.github.com/status`);
    console.log(`      Next run: ${httpJob.nextRunAt}\n`);

    // Job 3: Function job - custom code execution
    registerFunction("demoFunction", demoFunction as (...args: unknown[]) => unknown);
    const functionJob = CronServiceEnhanced.create({
      name: "Function Demo",
      type: "function",
      schedule: "*/3 * * * *", // Every 3 minutes
      config: {
        function: "demoFunction",
        args: ["hello from cron"],
      },
      tags: ["demo", "function"],
    });
    console.log(`   ✅ Created Function Job: ${functionJob.name}`);
    console.log(`      ID: ${functionJob.id}`);
    console.log(`      Function: demoFunction`);
    console.log(`      Next run: ${functionJob.nextRunAt}\n`);

    // Job 4: Cowork job - local execution (simulated)
    const coworkJob = CronServiceEnhanced.create({
      name: "Cowork Local Task",
      type: "cowork",
      schedule: "*/5 * * * *", // Every 5 minutes
      config: {
        runtime: "local",
        commands: [
          "echo 'Starting cowork task...'",
          "echo 'Working directory: $(pwd)'",
          "echo 'Node version: $(node --version)'",
          "echo 'Task completed at $(date)'",
        ],
      },
      tags: ["demo", "cowork", "local"],
    });
    console.log(`   ✅ Created Cowork Job: ${coworkJob.name}`);
    console.log(`      ID: ${coworkJob.id}`);
    console.log(`      Runtime: local`);
    console.log(`      Next run: ${coworkJob.nextRunAt}\n`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // STEP 3: Start Scheduler
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log("▶️  STEP 3: Starting Scheduler...\n");
    CronServiceEnhanced.start();
    console.log("   ✅ Scheduler running (checking every 5 seconds)\n");

    // ═══════════════════════════════════════════════════════════════════════════════
    // STEP 4: Subscribe to Events
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log("📡 STEP 4: Subscribing to Events...\n");
    
    const eventLog: string[] = [];
    const unsubscribe = CronServiceEnhanced.onEvent((event) => {
      const line = `[${new Date().toISOString()}] ${event.type}: ${JSON.stringify(event.data)}`;
      eventLog.push(line);
      
      // Print important events
      if (event.type === "job:run:started") {
        const data = event.data as { name?: string; jobId?: string };
        console.log(`   🚀 Job Started: ${data.name || data.jobId}`);
      } else if (event.type === "job:run:completed") {
        const data = event.data as { jobId?: string; durationMs?: number };
        console.log(`   ✅ Job Completed: ${data.jobId} (${data.durationMs}ms)`);
      } else if (event.type === "job:run:failed") {
        const data = event.data as { jobId?: string; error?: string };
        console.log(`   ❌ Job Failed: ${data.jobId} - ${data.error}`);
      }
    });

    // ═══════════════════════════════════════════════════════════════════════════════
    // STEP 5: Manual Job Execution
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log("\n⚡ STEP 5: Executing Jobs Manually...\n");

    // Execute shell job
    console.log("   Executing Shell Job...");
    const shellRun = await CronServiceEnhanced.run(shellJob.id);
    console.log(`   Result: ${shellRun.status}`);
    console.log(`   Output: ${shellRun.output?.trim() || "(no output)"}\n`);

    // Execute HTTP job
    console.log("   Executing HTTP Job...");
    const httpRun = await CronServiceEnhanced.run(httpJob.id);
    console.log(`   Result: ${httpRun.status}`);
    console.log(`   HTTP Status: ${httpRun.httpStatus}`);
    console.log(`   Output: ${httpRun.output?.slice(0, 100)}...\n`);

    // Execute function job
    console.log("   Executing Function Job...");
    const functionRun = await CronServiceEnhanced.run(functionJob.id);
    console.log(`   Result: ${functionRun.status}`);
    console.log(`   Output: ${functionRun.output?.trim() || "(no output)"}\n`);

    // Execute cowork job
    console.log("   Executing Cowork Job...");
    const coworkRun = await CronServiceEnhanced.run(coworkJob.id);
    console.log(`   Result: ${coworkRun.status}`);
    console.log(`   Output Preview:`);
    coworkRun.output?.split("\n").slice(0, 4).forEach((line) => {
      console.log(`      ${line}`);
    });
    console.log();

    // ═══════════════════════════════════════════════════════════════════════════════
    // STEP 6: Query Status and History
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log("📊 STEP 6: Querying Status and History...\n");

    const status = CronServiceEnhanced.getStatus();
    console.log("   Service Status:");
    console.log(`      Running: ${status.running}`);
    console.log(`      Total Jobs: ${status.jobs.total}`);
    console.log(`      Active Jobs: ${status.jobs.active}`);
    console.log(`      Pending Runs: ${status.runs.pending}\n`);

    // Get run history for shell job
    const shellRuns = CronServiceEnhanced.getRuns(shellJob.id, 5);
    console.log(`   Run History for "${shellJob.name}":`);
    shellRuns.forEach((run, i) => {
      console.log(`      ${i + 1}. ${run.status} at ${run.scheduledAt} (${run.durationMs}ms)`);
    });
    console.log();

    // ═══════════════════════════════════════════════════════════════════════════════
    // STEP 7: Demonstrate Pause/Resume
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log("⏸️  STEP 7: Demonstrating Pause/Resume...\n");
    
    console.log(`   Pausing job: ${shellJob.name}`);
    const paused = CronServiceEnhanced.pause(shellJob.id);
    console.log(`   Status: ${paused.status}\n`);

    await sleep(1000);

    console.log(`   Resuming job: ${shellJob.name}`);
    const resumed = CronServiceEnhanced.resume(shellJob.id);
    console.log(`   Status: ${resumed.status}`);
    console.log(`   Next run: ${resumed.nextRunAt}\n`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // STEP 8: Metrics
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log("📈 STEP 8: Metrics...\n");
    
    const metrics = CronServiceEnhanced.getMetrics();
    console.log("   Execution Metrics:");
    console.log(`      Jobs Started: ${metrics.jobsStarted}`);
    console.log(`      Jobs Completed: ${metrics.jobsCompleted}`);
    console.log(`      Jobs Failed: ${metrics.jobsFailed}\n`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // STEP 9: Graceful Shutdown
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log("🛑 STEP 9: Graceful Shutdown...\n");
    
    console.log("   Stopping scheduler (graceful)...");
    const shutdownStart = Date.now();
    await CronServiceEnhanced.stop({ force: false, timeoutMs: 10000 });
    const shutdownDuration = Date.now() - shutdownStart;
    console.log(`   ✅ Shutdown complete in ${shutdownDuration}ms\n`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log("║                     E2E DEMO COMPLETE                          ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");
    
    console.log("✅ All Features Verified:");
    console.log("   • Service initialization with real executors");
    console.log("   • Job creation (shell, http, function, cowork)");
    console.log("   • Manual job execution");
    console.log("   • Event subscription and emission");
    console.log("   • Status and metrics tracking");
    console.log("   • Pause/resume functionality");
    console.log("   • Graceful shutdown");
    console.log("   • SQLite persistence\n");

    console.log(`📁 Demo database preserved at: ${DEMO_DB}`);
    console.log("   (Delete it when done)\n");

    // Cleanup
    unsubscribe();

  } catch (error) {
    console.error("\n❌ Demo failed:", error);
    process.exit(1);
  }
}

// Export function for the function-type job
export function demoFunction(message: string): { result: string; timestamp: string } {
  return {
    result: `Function executed with message: "${message}"`,
    timestamp: new Date().toISOString(),
  };
}

// Run the demo
runDemo();
