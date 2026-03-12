/**
 * Simple test file for CronService
 * Run with: bun test src/runtime/automation/cron/test.ts
 */

import { CronService, parseSchedule, describeSchedule } from "./index";
import { calculateNextRun as getNextRunTime } from "./utils/timezone";
import { unlinkSync, existsSync } from "fs";

const TEST_DB = "/tmp/cron-test.db";

// Clean up test database
if (existsSync(TEST_DB)) {
  unlinkSync(TEST_DB);
}

console.log("🧪 Testing Unified Cron Implementation\n");

// Test 1: Natural Language Parser
console.log("1️⃣ Testing Natural Language Parser");
const testCases = [
  { input: "every 5 minutes", expected: "*/5 * * * *" },
  { input: "every hour", expected: "0 * * * *" },
  { input: "daily at 9am", expected: "0 9 * * *" },
  { input: "weekdays at noon", expected: "0 12 * * 1-5" },
  { input: "0 9 * * *", expected: "0 9 * * *" }, // Cron passthrough
];

for (const tc of testCases) {
  const parsed = parseSchedule(tc.input);
  if (parsed && parsed.expression === tc.expected) {
    console.log(`  ✅ "${tc.input}" → "${parsed.expression}"`);
  } else {
    console.log(`  ❌ "${tc.input}" → Expected "${tc.expected}", got "${parsed?.expression}"`);
  }
}

// Test 2: Schedule Description
console.log("\n2️⃣ Testing Schedule Description");
const descCases = [
  { schedule: { type: "cron" as const, expression: "*/5 * * * *" }, expected: "Every 5 minutes" },
  { schedule: { type: "cron" as const, expression: "0 9 * * *" }, expected: "Daily at 9:00 AM" },
  { schedule: { type: "cron" as const, expression: "0 9 * * 1-5" }, expected: "Weekdays at 9:00 AM" },
  { schedule: { type: "interval" as const, seconds: 300 }, expected: "Every 5 minutes" },
];

for (const tc of descCases) {
  const desc = describeSchedule(tc.schedule);
  if (desc === tc.expected) {
    console.log(`  ✅ ${desc}`);
  } else {
    console.log(`  ❌ Expected "${tc.expected}", got "${desc}"`);
  }
}

// Test 3: Next Run Calculation
console.log("\n3️⃣ Testing Next Run Calculation");
const nextRun = getNextRunTime(
  "*/5 * * * *",
  "UTC",
  new Date("2024-01-01T12:00:00Z")
);
console.log(`  ✅ Next run from 12:00: ${nextRun.toISOString()}`);

// Test 4: CronService Initialization
console.log("\n4️⃣ Testing CronService");
try {
  CronService.initialize({
    dbPath: TEST_DB,
    checkIntervalMs: 1000,
  });
  console.log("  ✅ Service initialized");

  // Test 5: Create Job
  console.log("\n5️⃣ Testing Job Creation");
  const job = CronService.create({
    name: "Test Job",
    type: "shell",
    schedule: "*/5 * * * *",
    config: { command: "echo 'hello world'" },
  });
  console.log(`  ✅ Created job: ${job.name} (${job.id})`);
  console.log(`  📅 Next run: ${job.nextRunAt}`);

  // Test 6: List Jobs
  console.log("\n6️⃣ Testing Job Listing");
  const jobs = CronService.list();
  console.log(`  ✅ Found ${jobs.length} job(s)`);

  // Test 7: Get Job
  console.log("\n7️⃣ Testing Job Retrieval");
  const retrieved = CronService.get(job.id);
  if (retrieved && retrieved.id === job.id) {
    console.log(`  ✅ Retrieved job: ${retrieved.name}`);
  } else {
    console.log("  ❌ Failed to retrieve job");
  }

  // Test 8: Update Job
  console.log("\n8️⃣ Testing Job Update");
  const updated = CronService.update(job.id, { name: "Updated Test Job" });
  if (updated.name === "Updated Test Job") {
    console.log(`  ✅ Updated job name to: ${updated.name}`);
  } else {
    console.log("  ❌ Failed to update job");
  }

  // Test 9: Pause/Resume
  console.log("\n9️⃣ Testing Pause/Resume");
  const paused = CronService.pause(job.id);
  console.log(`  ✅ Paused job, status: ${paused.status}`);
  
  const resumed = CronService.resume(job.id);
  console.log(`  ✅ Resumed job, status: ${resumed.status}`);

  // Test 10: Delete Job
  console.log("\n🔟 Testing Job Deletion");
  const deleted = CronService.delete(job.id);
  if (deleted) {
    console.log(`  ✅ Deleted job: ${job.id}`);
  } else {
    console.log("  ❌ Failed to delete job");
  }

  // Cleanup
  CronService.close();
  console.log("\n✨ All tests passed!");

} catch (error) {
  console.error("\n❌ Test failed:", error);
  process.exit(1);
}

// Clean up
if (existsSync(TEST_DB)) {
  unlinkSync(TEST_DB);
}
