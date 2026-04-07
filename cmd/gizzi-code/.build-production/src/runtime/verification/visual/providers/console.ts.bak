/**
 * Console Output Capture Provider
 * 
 * Captures test output as visual artifacts with rich formatting.
 */

import { VisualCaptureProvider, type CaptureContext } from "./base";
import type { ConsoleOutputArtifact, VisualArtifact } from "../types";
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs/promises";

export interface ConsoleCaptureOptions {
  /** Commands to run */
  commands?: string[];
  
  /** Parse test output format */
  testFramework?: "jest" | "vitest" | "mocha" | "pytest" | "bun";
  
  /** Maximum output lines to capture */
  maxLines?: number;
}

export class ConsoleCaptureProvider extends VisualCaptureProvider {
  readonly type = "console-output" as const;
  readonly name = "Console Output";
  readonly supported = true;
  
  constructor(
    options: ConstructorParameters<typeof VisualCaptureProvider>[0],
    private consoleOptions: ConsoleCaptureOptions = {}
  ) {
    super(options);
  }
  
  async checkAvailability(): Promise<boolean> {
    return true; // Always available
  }
  
  async capture(context: CaptureContext): Promise<VisualArtifact[]> {
    const artifacts: ConsoleOutputArtifact[] = [];
    const commands = this.consoleOptions.commands || this.inferCommands(context);
    
    for (const command of commands) {
      const artifact = await this.captureCommand(command, context);
      if (artifact) artifacts.push(artifact);
    }
    
    return artifacts;
  }
  
  private inferCommands(context: CaptureContext): string[] {
    const commands: string[] = [];
    
    if (context.testFiles?.length) {
      // Detect test framework
      const hasPackageJson = this.fileExists("package.json");
      const hasVitestConfig = this.fileExists("vitest.config.ts") || 
                              this.fileExists("vitest.config.js");
      const hasJestConfig = this.fileExists("jest.config.js") || 
                            this.fileExists("jest.config.ts");
      
      if (hasVitestConfig || hasPackageJson) {
        commands.push("npm test -- --reporter=verbose");
      } else if (hasJestConfig) {
        commands.push("npm test -- --verbose");
      }
    }
    
    if (context.files?.length) {
      // Type check
      if (this.fileExists("tsconfig.json")) {
        commands.push("npx tsc --noEmit");
      }
      
      // Lint
      if (this.fileExists("eslint.config.js") || this.fileExists(".eslintrc")) {
        commands.push("npx eslint " + context.files.join(" "));
      }
    }
    
    return commands.length ? commands : ["echo 'No commands inferred'"];
  }
  
  private async captureCommand(
    command: string,
    context: CaptureContext
  ): Promise<ConsoleOutputArtifact | null> {
    const startTime = Date.now();
    
    try {
      const output = execSync(command, {
        cwd: context.cwd,
        encoding: "utf-8",
        timeout: 60000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      
      const duration = Date.now() - startTime;
      const testResults = this.parseTestOutput(output);
      
      const artifact: ConsoleOutputArtifact = {
        id: this.generateId("console"),
        type: "console-output",
        description: `Command output: ${command.split(" ")[0]}`,
        timestamp: new Date().toISOString(),
        verificationClaim: testResults 
          ? `Tests: ${testResults.passed}/${testResults.total} passed`
          : `Command completed successfully`,
        confidence: testResults?.failed === 0 ? 1.0 : 0.0,
        annotations: this.createAnnotations(testResults),
        llmContext: this.formatForLLM(command, output, testResults),
        data: {
          command,
          exitCode: 0,
          stdout: this.truncateOutput(output),
          stderr: "",
          durationMs: duration,
          testResults: testResults || undefined,
        },
      };
      
      return artifact;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const stdout = error.stdout?.toString() || "";
      const stderr = error.stderr?.toString() || error.message || "";
      const testResults = this.parseTestOutput(stdout + stderr);
      
      const artifact: ConsoleOutputArtifact = {
        id: this.generateId("console"),
        type: "console-output",
        description: `Command failed: ${command.split(" ")[0]}`,
        timestamp: new Date().toISOString(),
        verificationClaim: `Command failed with exit code ${error.status || 1}`,
        confidence: 0,
        annotations: [
          this.createAnnotation("FAILED", `Exit code: ${error.status || 1}`, { color: "red", severity: "error" }),
          ...(testResults?.failed ? [this.createAnnotation("TESTS", `${testResults.failed} tests failed`, { severity: "error" })] : []),
        ],
        llmContext: this.formatForLLM(command, stdout + "\n" + stderr, testResults, true),
        data: {
          command,
          exitCode: error.status || 1,
          stdout: this.truncateOutput(stdout),
          stderr: this.truncateOutput(stderr),
          durationMs: duration,
          testResults: testResults || undefined,
        },
      };
      
      return artifact;
    }
  }
  
  private parseTestOutput(output: string): ConsoleOutputArtifact["data"]["testResults"] | null {
    const framework = this.consoleOptions.testFramework;
    
    if (framework === "vitest" || output.includes("Vitest")) {
      return this.parseVitestOutput(output);
    }
    if (framework === "jest" || output.includes("jest")) {
      return this.parseJestOutput(output);
    }
    if (framework === "bun" || output.includes("bun test")) {
      return this.parseBunOutput(output);
    }
    
    // Generic pattern matching
    const passMatch = output.match(/(\d+)\s+passing/i);
    const failMatch = output.match(/(\d+)\s+failing/i);
    
    if (passMatch || failMatch) {
      const passed = parseInt(passMatch?.[1] || "0", 10);
      const failed = parseInt(failMatch?.[1] || "0", 10);
      return {
        passed,
        failed,
        skipped: 0,
        total: passed + failed,
        failures: [],
      };
    }
    
    return null;
  }
  
  private parseVitestOutput(output: string): ConsoleOutputArtifact["data"]["testResults"] {
    // Vitest output parsing
    const passedMatch = output.match(/(\d+)\s+passed/i);
    const failedMatch = output.match(/(\d+)\s+failed/i);
    const skippedMatch = output.match(/(\d+)\s+skipped/i);
    
    const passed = parseInt(passedMatch?.[1] || "0", 10);
    const failed = parseInt(failedMatch?.[1] || "0", 10);
    const skipped = parseInt(skippedMatch?.[1] || "0", 10);
    
    const failures: Array<{ name: string; message: string }> = [];
    const failPattern = /FAIL\s+(.+)\n.+\n?\s*AssertionError:\s*(.+)/g;
    let match;
    while ((match = failPattern.exec(output)) !== null) {
      failures.push({ name: match[1], message: match[2] });
    }
    
    return { passed, failed, skipped, total: passed + failed + skipped, failures };
  }
  
  private parseJestOutput(output: string): ConsoleOutputArtifact["data"]["testResults"] {
    const testsMatch = output.match(/Tests:\s+(\d+)\s+passed(?:,\s+(\d+)\s+failed)?/i);
    if (!testsMatch) return { passed: 0, failed: 0, skipped: 0, total: 0, failures: [] };
    
    const passed = parseInt(testsMatch[1], 10);
    const failed = parseInt(testsMatch[2] || "0", 10);
    
    return { passed, failed, skipped: 0, total: passed + failed, failures: [] };
  }
  
  private parseBunOutput(output: string): ConsoleOutputArtifact["data"]["testResults"] {
    const passMatch = output.match(/(\d+)\s+pass/i);
    const failMatch = output.match(/(\d+)\s+fail/i);
    
    const passed = parseInt(passMatch?.[1] || "0", 10);
    const failed = parseInt(failMatch?.[1] || "0", 10);
    
    return { passed, failed, skipped: 0, total: passed + failed, failures: [] };
  }
  
  private createAnnotations(testResults: ConsoleOutputArtifact["data"]["testResults"] | null) {
    const annotations = [];
    if (testResults) {
      annotations.push(
        this.createAnnotation("PASS", `${testResults.passed} passed`, { color: "green" }),
        this.createAnnotation("TOTAL", `${testResults.total} tests`, { color: "blue" })
      );
      if (testResults.failed > 0) {
        annotations.push(this.createAnnotation("FAIL", `${testResults.failed} failed`, { color: "red", severity: "error" }));
      }
    }
    return annotations;
  }
  
  private formatForLLM(
    command: string,
    output: string,
    testResults: ConsoleOutputArtifact["data"]["testResults"] | null,
    failed = false
  ): string {
    let context = `Command: ${command}\n`;
    context += `Status: ${failed ? "FAILED" : "PASSED"}\n\n`;
    
    if (testResults) {
      context += `Test Results: ${testResults.passed}/${testResults.total} passed`;
      if (testResults.failed > 0) context += `, ${testResults.failed} failed`;
      if (testResults.skipped > 0) context += `, ${testResults.skipped} skipped`;
      context += "\n\n";
      
      if (testResults.failures.length > 0) {
        context += "Failures:\n";
        for (const f of testResults.failures.slice(0, 5)) {
          context += `  - ${f.name}: ${f.message}\n`;
        }
      }
    }
    
    context += "\nOutput:\n" + output.slice(0, 2000);
    
    return context;
  }
  
  private truncateOutput(output: string): string {
    const maxLines = this.consoleOptions.maxLines || 500;
    const lines = output.split("\n");
    if (lines.length <= maxLines) return output;
    return lines.slice(0, maxLines).join("\n") + "\n... (truncated)";
  }
  
  private fileExists(file: string): boolean {
    try {
      execSync(`test -f ${file}`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }
}
