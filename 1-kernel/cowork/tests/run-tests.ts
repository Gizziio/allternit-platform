#!/usr/bin/env bun
/**
 * Test Runner for Cowork Runtime
 * 
 * Usage:
 *   bun run-tests.ts              # Run all tests
 *   bun run-tests.ts unit         # Run unit tests only
 *   bun run-tests.ts integration  # Run integration tests only
 *   bun run-tests.ts e2e          # Run E2E tests only
 */

import { spawn } from "child_process";
import { readdirSync, statSync } from "fs";
import { join } from "path";

const TEST_DIR = __dirname;

type TestSuite = "unit" | "integration" | "e2e" | "all";

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

async function runTestFile(filePath: string): Promise<TestResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const proc = spawn("bun", ["test", filePath], {
      stdio: "pipe",
    });

    let output = "";
    let errorOutput = "";

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    proc.on("close", (code) => {
      const duration = Date.now() - startTime;

      resolve({
        name: filePath.split("/").pop() || filePath,
        passed: code === 0,
        duration,
        error: code !== 0 ? errorOutput || output : undefined,
      });
    });
  });
}

function findTestFiles(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...findTestFiles(fullPath));
      } else if (entry.endsWith(".test.ts")) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return files;
}

async function runSuite(suite: TestSuite): Promise<TestResult[]> {
  const results: TestResult[] = [];

  if (suite === "all" || suite === "unit") {
    console.log("\n📦 Running Unit Tests...\n");
    const unitDir = join(TEST_DIR, "unit");
    const unitFiles = findTestFiles(unitDir);

    for (const file of unitFiles) {
      process.stdout.write(`  ${file.split("/").pop()}... `);
      const result = await runTestFile(file);
      results.push(result);
      console.log(result.passed ? "✅" : "❌");
    }
  }

  if (suite === "all" || suite === "integration") {
    console.log("\n🔗 Running Integration Tests...\n");
    const integrationDir = join(TEST_DIR, "integration");
    const integrationFiles = findTestFiles(integrationDir);

    for (const file of integrationFiles) {
      process.stdout.write(`  ${file.split("/").pop()}... `);
      const result = await runTestFile(file);
      results.push(result);
      console.log(result.passed ? "✅" : "❌");
    }
  }

  if (suite === "all" || suite === "e2e") {
    console.log("\n🚀 Running E2E Tests...\n");
    const e2eDir = join(TEST_DIR, "e2e");
    const e2eFiles = findTestFiles(e2eDir);

    for (const file of e2eFiles) {
      process.stdout.write(`  ${file.split("/").pop()}... `);
      const result = await runTestFile(file);
      results.push(result);
      console.log(result.passed ? "✅" : "❌");
    }
  }

  return results;
}

async function main() {
  const suite: TestSuite = (process.argv[2] as TestSuite) || "all";

  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║         Cowork Runtime Test Suite                       ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log(`\nRunning: ${suite.toUpperCase()} tests\n`);

  const startTime = Date.now();
  const results = await runSuite(suite);
  const totalDuration = Date.now() - startTime;

  // Print summary
  console.log("\n" + "═".repeat(56));
  console.log("\n📊 Test Summary:\n");

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`  Total:  ${results.length}`);
  console.log(`  Passed: ${passed} ✅`);
  console.log(`  Failed: ${failed} ❌`);
  console.log(`  Time:   ${(totalDuration / 1000).toFixed(2)}s`);

  if (failed > 0) {
    console.log("\n❌ Failed Tests:\n");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  • ${r.name}`);
        if (r.error) {
          console.log(`    ${r.error.slice(0, 200)}...`);
        }
      });
  }

  console.log("\n" + "═".repeat(56) + "\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Test runner failed:", error);
  process.exit(1);
});
