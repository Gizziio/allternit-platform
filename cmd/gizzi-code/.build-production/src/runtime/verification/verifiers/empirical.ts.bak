/**
 * Empirical Verifier
 * 
 * Traditional test-based verification through actual execution.
 * Complements the semi-formal verifier for high-confidence validation.
 */

import { Log } from "@/shared/util/log";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs/promises";
import * as glob from "glob";

import type { Plan } from "@/runtime/loop/planner";
import type { ExecutionReceipt } from "@/runtime/loop/executor";
import type {
  VerificationStrategy,
  VerificationContext,
  EmpiricalVerificationResult,
  TestResult,
  CodeCoverage,
} from "../types";

import { BaseVerifier, VerificationTimeoutError } from "./base";

const execAsync = promisify(exec);

// ============================================================================
// Configuration
// ============================================================================

export interface EmpiricalVerifierConfig {
  /** Command to run tests */
  testCommand: string;
  
  /** Working directory for tests */
  workingDirectory: string;
  
  /** Timeout for test execution (ms) */
  timeoutMs: number;
  
  /** Environment variables */
  env?: Record<string, string>;
  
  /** Whether to collect coverage */
  collectCoverage: boolean;
  
  /** Coverage command (if different from test command) */
  coverageCommand?: string;
  
  /** Test file patterns */
  testPatterns: string[];
  
  /** Parser for test output */
  outputParser: "jest" | "mocha" | "pytest" | "unittest" | "tap" | "custom";
  
  /** Custom parser function (if outputParser is 'custom') */
  customParser?: (output: string) => ParsedTestOutput;
}

export interface ParsedTestOutput {
  tests: Array<{
    name: string;
    file: string;
    passed: boolean;
    durationMs: number;
    error?: {
      message: string;
      stackTrace?: string;
      expected?: string;
      actual?: string;
    };
  }>;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped?: number;
    durationMs: number;
  };
  coverage?: CodeCoverage;
}

// ============================================================================
// Main Empirical Verifier Class
// ============================================================================

export class EmpiricalVerifier extends BaseVerifier<EmpiricalVerificationResult> {
  readonly type = "empirical";
  readonly version = "1.0.0";
  
  private config: EmpiricalVerifierConfig;
  private startTime: number = 0;
  
  constructor(
    id: string,
    config?: Partial<EmpiricalVerifierConfig>
  ) {
    super(id);
    this.config = this.buildConfig(config);
    this.log = Log.create({ service: "verification.empirical" });
  }
  
  /**
   * Main verification entry point - runs tests and analyzes results
   */
  async verify(
    plan: Plan,
    receipts: ExecutionReceipt[],
    context?: VerificationContext
  ): Promise<EmpiricalVerificationResult> {
    this.startTime = Date.now();
    this.checkCancelled();
    
    this.log.info("Starting empirical verification", {
      verifierId: this.id,
      planSteps: plan.steps.length,
      testCommand: this.config.testCommand,
    });
    
    try {
      // Detect test files if not specified
      const testFiles = await this.detectTestFiles(context);
      
      // Run tests
      const testOutput = await this.executePhase(
        "test_execution",
        () => this.runTests(testFiles)
      );
      
      // Parse results
      const parsedOutput = await this.executePhase<ParsedTestOutput>(
        "result_parsing",
        async () => this.parseTestOutput(testOutput)
      );
      
      // Collect coverage if enabled
      let coverage: CodeCoverage | undefined;
      if (this.config.collectCoverage) {
        coverage = await this.executePhase(
          "coverage_collection",
          () => this.collectCoverage(testFiles)
        );
      }
      
      // Analyze results
      const analysis = this.analyzeResults(parsedOutput, coverage);
      
      const durationMs = Date.now() - this.startTime;
      
      const result: EmpiricalVerificationResult = {
        passed: analysis.passed,
        reason: analysis.reason,
        nextAction: analysis.nextAction,
        testResults: parsedOutput.tests,
        execution: {
          durationMs,
          testsRun: parsedOutput.summary.total,
          testsPassed: parsedOutput.summary.passed,
          testsFailed: parsedOutput.summary.failed,
          coverage,
        },
        rawOutput: testOutput,
        exitCode: analysis.exitCode,
      };
      
      this.log.info("Empirical verification complete", {
        verifierId: this.id,
        passed: result.passed,
        testsRun: result.execution.testsRun,
        testsPassed: result.execution.testsPassed,
        testsFailed: result.execution.testsFailed,
        durationMs,
      });
      
      return result;
    } catch (error) {
      this.log.error("Empirical verification failed", {
        verifierId: this.id,
        error,
      });
      throw error;
    }
  }
  
  /**
   * Check if strategy is supported
   */
  supportsStrategy(strategy: VerificationStrategy): boolean {
    return strategy.mode === "empirical" || strategy.mode === "both" || strategy.mode === "adaptive";
  }
  
  // ========================================================================
  // Private Methods
  // ========================================================================
  
  /**
   * Build configuration with defaults
   */
  private buildConfig(config?: Partial<EmpiricalVerifierConfig>): EmpiricalVerifierConfig {
    return {
      testCommand: config?.testCommand || "npm test",
      workingDirectory: config?.workingDirectory || process.cwd(),
      timeoutMs: config?.timeoutMs || 300000, // 5 minutes
      env: config?.env || {},
      collectCoverage: config?.collectCoverage ?? true,
      coverageCommand: config?.coverageCommand,
      testPatterns: config?.testPatterns || [
        "**/*.test.ts",
        "**/*.test.js",
        "**/*.spec.ts",
        "**/*.spec.js",
        "**/test/**/*.ts",
        "**/tests/**/*.ts",
      ],
      outputParser: config?.outputParser || "jest",
      customParser: config?.customParser,
    };
  }
  
  /**
   * Detect test files in the project
   */
  private async detectTestFiles(context?: VerificationContext): Promise<string[]> {
    this.updateProgress({ currentPhase: "detecting_tests" });
    
    // Use provided test files if available
    if (context?.testFiles && context.testFiles.length > 0) {
      return context.testFiles;
    }
    
    // Search for test files
    const testFiles: string[] = [];
    
    for (const pattern of this.config.testPatterns) {
      try {
        const files = await glob.glob(pattern, {
          cwd: this.config.workingDirectory,
          absolute: false,
        });
        testFiles.push(...files);
      } catch (error) {
        this.log.warn("Failed to search for test files", { pattern, error });
      }
    }
    
    // If patches are provided, filter to related tests
    if (context?.patches && context.patches.length > 0) {
      return this.filterRelatedTests(testFiles, context.patches);
    }
    
    return [...new Set(testFiles)];
  }
  
  /**
   * Filter tests related to modified files
   */
  private async filterRelatedTests(
    testFiles: string[],
    patches: NonNullable<VerificationContext["patches"]>
  ): Promise<string[]> {
    const modifiedFiles = patches.map(p => p.path);
    const related: string[] = [];
    
    for (const testFile of testFiles) {
      try {
        const testPath = path.join(this.config.workingDirectory, testFile);
        const content = await fs.readFile(testPath, "utf-8");
        
        // Check if test references any modified files
        for (const modifiedFile of modifiedFiles) {
          const baseName = path.basename(modifiedFile, path.extname(modifiedFile));
          const dirName = path.dirname(modifiedFile).split(path.sep).pop();
          
          if (content.includes(baseName) || 
              (dirName && content.includes(dirName)) ||
              content.includes(modifiedFile)) {
            related.push(testFile);
            break;
          }
        }
      } catch (error) {
        this.log.warn("Failed to read test file", { testFile, error });
      }
    }
    
    return related.length > 0 ? related : testFiles;
  }
  
  /**
   * Run the test command
   */
  private async runTests(testFiles: string[]): Promise<string> {
    this.updateProgress({ currentPhase: "running_tests" });
    
    const command = this.config.testCommand;
    const cwd = this.config.workingDirectory;
    const timeout = this.config.timeoutMs;
    
    this.log.debug("Running tests", { command, cwd, timeout });
    
    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        cwd,
        env: { ...process.env, ...this.config.env },
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      
      let stdout = "";
      let stderr = "";
      let timeoutId: NodeJS.Timeout;
      
      // Collect stdout
      child.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });
      
      // Collect stderr
      child.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });
      
      // Set timeout
      timeoutId = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new VerificationTimeoutError(this.id, timeout, "test_execution"));
      }, timeout);
      
      // Handle completion
      child.on("close", (code) => {
        clearTimeout(timeoutId);
        
        // Combine stdout and stderr for parsing
        const output = stdout + "\n" + stderr;
        resolve(output);
      });
      
      child.on("error", (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }
  
  /**
   * Parse test output based on configured parser
   */
  private parseTestOutput(output: string): ParsedTestOutput {
    this.updateProgress({ currentPhase: "parsing_output" });
    
    switch (this.config.outputParser) {
      case "jest":
        return this.parseJestOutput(output);
      case "mocha":
        return this.parseMochaOutput(output);
      case "pytest":
        return this.parsePytestOutput(output);
      case "unittest":
        return this.parseUnittestOutput(output);
      case "tap":
        return this.parseTapOutput(output);
      case "custom":
        if (this.config.customParser) {
          return this.config.customParser(output);
        }
        throw new Error("Custom parser configured but not provided");
      default:
        throw new Error(`Unknown output parser: ${this.config.outputParser}`);
    }
  }
  
  /**
   * Parse Jest output
   */
  private parseJestOutput(output: string): ParsedTestOutput {
    const tests: ParsedTestOutput["tests"] = [];
    let summary = { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 };
    
    // Parse individual test results
    const testRegex = /(✓|✕|○)\s+(.+?)(?:\s+\((\d+)ms\))?$/gm;
    let match;
    while ((match = testRegex.exec(output)) !== null) {
      const [, status, name, duration] = match;
      const passed = status === "✓";
      const failed = status === "✕";
      
      tests.push({
        name: name.trim(),
        file: "", // Will be filled from stack trace or file pattern
        passed,
        durationMs: duration ? parseInt(duration, 10) : 0,
      });
      
      if (passed) summary.passed++;
      else if (failed) summary.failed++;
      else summary.skipped++;
      summary.total++;
    }
    
    // Parse summary
    const summaryMatch = output.match(/Tests:\s+(\d+)\s+passed,?\s+(\d+)\s+failed,?\s+(\d+)\s+skipped/);
    if (summaryMatch) {
      summary = {
        total: parseInt(summaryMatch[1], 10) + parseInt(summaryMatch[2], 10) + parseInt(summaryMatch[3], 10),
        passed: parseInt(summaryMatch[1], 10),
        failed: parseInt(summaryMatch[2], 10),
        skipped: parseInt(summaryMatch[3], 10),
        durationMs: summary.durationMs,
      };
    }
    
    // Parse time
    const timeMatch = output.match(/Time:\s+([\d.]+)\s*s/);
    if (timeMatch) {
      summary.durationMs = parseFloat(timeMatch[1]) * 1000;
    }
    
    // Parse failures for error details
    const failureRegex = /●\s+(.+?)\s+\n+\s+(.+?):(\d+):(\d+)\s+\n+\s+(.+?)(?=\n+●|\n+Test Suites:|$)/gs;
    while ((match = failureRegex.exec(output)) !== null) {
      const [, name, file, line, col, message] = match;
      const test = tests.find(t => t.name.includes(name) || name.includes(t.name));
      if (test) {
        test.file = file;
        test.error = {
          message: message.trim(),
        };
      }
    }
    
    return { tests, summary };
  }
  
  /**
   * Parse Mocha output
   */
  private parseMochaOutput(output: string): ParsedTestOutput {
    const tests: ParsedTestOutput["tests"] = [];
    let summary = { total: 0, passed: 0, failed: 0, durationMs: 0 };
    
    // Parse passing tests
    const passRegex = /✓\s+(.+?)(?:\s+\((\d+)ms\))?$/gm;
    let match;
    while ((match = passRegex.exec(output)) !== null) {
      const [, name, duration] = match;
      tests.push({
        name: name.trim(),
        file: "",
        passed: true,
        durationMs: duration ? parseInt(duration, 10) : 0,
      });
      summary.passed++;
      summary.total++;
    }
    
    // Parse failing tests
    const failRegex = /(\d+)\)\s+(.+)$/gm;
    while ((match = failRegex.exec(output)) !== null) {
      const [, num, name] = match;
      tests.push({
        name: name.trim(),
        file: "",
        passed: false,
        durationMs: 0,
      });
      summary.failed++;
      summary.total++;
    }
    
    // Parse summary
    const summaryMatch = output.match(/(\d+)\s+passing\s+\(([\d.]+)(ms|s)\)/);
    if (summaryMatch) {
      summary.passed = parseInt(summaryMatch[1], 10);
      const time = parseFloat(summaryMatch[2]);
      summary.durationMs = summaryMatch[3] === "s" ? time * 1000 : time;
    }
    
    const failSummaryMatch = output.match(/(\d+)\s+failing/);
    if (failSummaryMatch) {
      summary.failed = parseInt(failSummaryMatch[1], 10);
    }
    
    summary.total = summary.passed + summary.failed;
    
    return { tests, summary };
  }
  
  /**
   * Parse pytest output
   */
  private parsePytestOutput(output: string): ParsedTestOutput {
    const tests: ParsedTestOutput["tests"] = [];
    let summary = { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 };
    
    // Parse test results
    const testRegex = /(\S+::\S+)\s+(PASSED|FAILED|ERROR|SKIPPED)/g;
    let match;
    while ((match = testRegex.exec(output)) !== null) {
      const [, testId, status] = match;
      const [file, name] = testId.split("::");
      
      tests.push({
        name: name || testId,
        file: file || "",
        passed: status === "PASSED",
        durationMs: 0,
      });
      
      if (status === "PASSED") summary.passed++;
      else if (status === "FAILED" || status === "ERROR") summary.failed++;
      else if (status === "SKIPPED") summary.skipped++;
      summary.total++;
    }
    
    // Parse summary
    const summaryMatch = output.match(/(\d+)\s+passed.*?,(\d+)\s+failed.*?,(\d+)\s+skipped/s);
    if (summaryMatch) {
      summary.passed = parseInt(summaryMatch[1], 10);
      summary.failed = parseInt(summaryMatch[2], 10);
      summary.skipped = parseInt(summaryMatch[3], 10);
      summary.total = summary.passed + summary.failed + summary.skipped;
    }
    
    // Parse time
    const timeMatch = output.match(/in\s+([\d.]+)s/);
    if (timeMatch) {
      summary.durationMs = parseFloat(timeMatch[1]) * 1000;
    }
    
    return { tests, summary };
  }
  
  /**
   * Parse Python unittest output
   */
  private parseUnittestOutput(output: string): ParsedTestOutput {
    // Similar structure to pytest but different format
    // Simplified implementation
    const tests: ParsedTestOutput["tests"] = [];
    let summary = { total: 0, passed: 0, failed: 0, durationMs: 0 };
    
    const okMatch = output.match(/OK/);
    const failMatch = output.match(/FAILED\s+\(failures=(\d+)\)/);
    
    if (okMatch) {
      summary.passed = 1; // Can't easily determine count from OK alone
      summary.total = 1;
    } else if (failMatch) {
      summary.failed = parseInt(failMatch[1], 10);
      summary.total = summary.failed;
    }
    
    return { tests, summary };
  }
  
  /**
   * Parse TAP (Test Anything Protocol) output
   */
  private parseTapOutput(output: string): ParsedTestOutput {
    const tests: ParsedTestOutput["tests"] = [];
    let summary = { total: 0, passed: 0, failed: 0, durationMs: 0 };
    
    // Parse TAP version
    const versionMatch = output.match(/TAP\s+version\s+(\d+)/);
    if (!versionMatch) {
      throw new Error("Invalid TAP output: no version header");
    }
    
    // Parse test plan
    const planMatch = output.match(/^(\d+)\.\.(\d+)/m);
    if (planMatch) {
      summary.total = parseInt(planMatch[2], 10);
    }
    
    // Parse test results
    const testLineRegex = /^(ok|not ok)\s+(\d+)\s+(.+?)(?:\s+#\s+(.+))?$/gm;
    let match;
    while ((match = testLineRegex.exec(output)) !== null) {
      const [, status, num, description, directive] = match;
      const passed = status === "ok";
      const skipped = directive?.toLowerCase().includes("skip");
      
      tests.push({
        name: description.trim(),
        file: "",
        passed: passed && !skipped,
        durationMs: 0,
      });
      
      if (passed && !skipped) summary.passed++;
      else if (!passed) summary.failed++;
    }
    
    return { tests, summary };
  }
  
  /**
   * Collect code coverage
   */
  private async collectCoverage(testFiles: string[]): Promise<CodeCoverage | undefined> {
    this.updateProgress({ currentPhase: "collecting_coverage" });
    
    if (!this.config.collectCoverage) {
      return undefined;
    }
    
    try {
      // Run coverage command if different from test command
      const command = this.config.coverageCommand || this.config.testCommand;
      const { stdout } = await execAsync(command, {
        cwd: this.config.workingDirectory,
        env: { ...process.env, ...this.config.env, COLLECT_COVERAGE: "true" },
        timeout: this.config.timeoutMs,
      });
      
      // Try to parse coverage from output
      return this.parseCoverageOutput(stdout);
    } catch (error) {
      this.log.warn("Failed to collect coverage", { error });
      return undefined;
    }
  }
  
  /**
   * Parse coverage output
   */
  private parseCoverageOutput(output: string): CodeCoverage | undefined {
    // Try to find coverage summary in output
    const coverageRegex = /All\s+files\s+\|\s*[\d.]+\s*\|\s*([\d.]+)\s*\|\s*[\d.]+\s*\|\s*[\d.]+\s*\|\s*([\d.]+)/;
    const match = output.match(coverageRegex);
    
    if (match) {
      return {
        percentage: parseFloat(match[1]),
        files: [], // Would need to parse detailed report
      };
    }
    
    return undefined;
  }
  
  /**
   * Analyze results and determine overall pass/fail
   */
  private analyzeResults(
    parsedOutput: ParsedTestOutput,
    coverage?: CodeCoverage
  ): {
    passed: boolean;
    reason: string;
    nextAction: "stop" | "continue" | "replan" | "ask_user";
    exitCode: number;
  } {
    const { summary } = parsedOutput;
    
    // Determine pass/fail
    const allPassed = summary.failed === 0 && summary.total > 0;
    const exitCode = allPassed ? 0 : 1;
    
    // Build reason
    let reason: string;
    if (summary.total === 0) {
      reason = "No tests were run";
    } else if (allPassed) {
      reason = `All ${summary.total} tests passed`;
      if (coverage) {
        reason += ` with ${coverage.percentage.toFixed(1)}% code coverage`;
      }
    } else {
      reason = `${summary.failed} of ${summary.total} tests failed`;
    }
    
    // Determine next action
    let nextAction: "stop" | "continue" | "replan" | "ask_user";
    if (allPassed) {
      nextAction = "stop";
    } else if (summary.failed > summary.total * 0.5) {
      nextAction = "replan";
    } else {
      nextAction = "continue";
    }
    
    return { passed: allPassed, reason, nextAction, exitCode };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createEmpiricalVerifier(
  config?: Partial<EmpiricalVerifierConfig>
): EmpiricalVerifier {
  const { randomUUID } = require("crypto");
  return new EmpiricalVerifier(`empirical_${randomUUID().slice(0, 8)}`, config);
}
