/**
 * Error State Capture Provider
 * 
 * Captures visual representations of errors using existing browser skills.
 */

import { VisualCaptureProvider, type CaptureContext } from "./base";
import type { ErrorStateArtifact, VisualArtifact, ImageData } from "../types";
import { BrowserAdapter, checkDevServer } from "../browser/adapter";
import * as path from "path";
import * as fs from "fs/promises";

interface TestFailure {
  testName: string;
  message: string;
  stack?: string;
  expected?: string;
  actual?: string;
}

export class ErrorStateCaptureProvider extends VisualCaptureProvider {
  readonly type = "error-state" as const;
  readonly name = "Error State";
  readonly supported = true;
  
  private browser: BrowserAdapter | null = null;
  
  async checkAvailability(): Promise<boolean> {
    const available = await BrowserAdapter.detectAvailable();
    return available !== null;
  }
  
  async capture(context: CaptureContext): Promise<VisualArtifact[]> {
    const artifacts: ErrorStateArtifact[] = [];
    
    // Check for test failures in context
    const testResults = context.testResults as any;
    if (!testResults?.failures?.length) {
      return artifacts;
    }
    
    // Detect which browser automation to use
    const browserType = await BrowserAdapter.detectAvailable();
    if (!browserType) {
      console.warn("No browser automation available for error capture");
      return artifacts;
    }
    
    // Initialize browser adapter
    this.browser = new BrowserAdapter({
      type: browserType,
      outputDir: this.options.outputDir,
      viewport: this.options.viewport,
    });
    
    // Capture each failure
    for (const failure of testResults.failures) {
      const artifact = await this.captureErrorState(failure, context);
      if (artifact) artifacts.push(artifact);
    }
    
    // Capture any app error states
    const appErrorArtifact = await this.captureAppErrorState(context);
    if (appErrorArtifact) artifacts.push(appErrorArtifact);
    
    return artifacts;
  }
  
  private async captureErrorState(
    failure: TestFailure,
    context: CaptureContext
  ): Promise<ErrorStateArtifact | null> {
    try {
      // Create HTML showing the error
      const errorHtml = this.buildErrorHtml(failure);
      
      // Render and screenshot
      const renderResult = await this.browser!.renderHTML(errorHtml, {
        waitForTimeout: 100,
      });
      
      const imageData = await this.createImageData(renderResult.screenshot.path, "png");
      
      // Parse stack trace for code context
      const codeContext = this.parseStackTrace(failure.stack, context.cwd);
      
      const artifact: ErrorStateArtifact = {
        id: this.generateId("error"),
        type: "error-state",
        description: `Test failure: ${failure.testName}`,
        timestamp: new Date().toISOString(),
        verificationClaim: `Test "${failure.testName}" failed with error`,
        confidence: 1.0, // Errors are factual
        image: imageData,
        annotations: [
          this.createAnnotation("TEST", failure.testName, { color: "red" }),
          this.createAnnotation("ERROR", failure.message.substring(0, 100), { 
            color: "red", 
            severity: "error" 
          }),
          ...(codeContext ? [this.createAnnotation(
            "LOCATION",
            `${codeContext.file}:${codeContext.line}`,
            { color: "orange" }
          )] : []),
        ],
        llmContext: this.formatForLLM(failure, codeContext),
        data: {
          errorType: "test-failure" as const,
          message: failure.message,
          stackTrace: failure.stack,
          codeContext: codeContext ? { ...codeContext, column: codeContext.column ?? 0 } : undefined,
          screenshot: await this.createImageData(renderResult.screenshot.path, "png"),
          consoleOutput: renderResult.consoleLogs.map(l => `[${l.type}] ${l.text}`).join("\n").slice(0, 2000),
        },
      };
      
      return artifact;
    } catch (error) {
      console.error("Failed to capture error state:", error);
      return this.createFallbackErrorArtifact(failure);
    }
  }
  
  private async captureAppErrorState(context: CaptureContext): Promise<ErrorStateArtifact | null> {
    // Check for dev server
    const hasDevServer = await checkDevServer(3000) || await checkDevServer(5173) || await checkDevServer(8080);
    if (!hasDevServer) return null;
    
    try {
      const port = (await checkDevServer(3000)) ? 3000 : 
                   (await checkDevServer(5173)) ? 5173 : 8080;
      
      const renderResult = await this.browser!.renderURL(`http://localhost:${port}`, {
        waitForTimeout: 1000,
      });
      
      // Only create artifact if there are errors
      if (renderResult.errors.length === 0 && 
          !renderResult.consoleLogs.some(l => l.type === "error")) {
        return null;
      }
      
      const imageData = await this.createImageData(renderResult.screenshot.path, "png");
      
      return {
        id: this.generateId("error-app"),
        type: "error-state",
        description: "Application error state",
        timestamp: new Date().toISOString(),
        verificationClaim: "Application has runtime errors",
        confidence: 1.0,
        image: imageData,
        annotations: [
          this.createAnnotation("SERVER", `localhost:${port}`, { color: "green" }),
          this.createAnnotation("ERRORS", `${renderResult.errors.length} errors`, {
            color: "red",
            severity: "error",
          }),
          this.createAnnotation("CONSOLE", `${renderResult.consoleLogs.filter(l => l.type === "error").length} console errors`, {
            color: "orange",
            severity: "warning",
          }),
        ],
        llmContext: `Application at localhost:${port} has errors:\n${renderResult.errors.join("\n")}`,
        data: {
          errorType: "runtime" as const,
          message: renderResult.errors[0] || "Runtime error",
          consoleOutput: renderResult.consoleLogs.filter(l => l.type === "error").map(l => l.text).join("\n"),
        },
      };
    } catch {
      return null;
    }
  }
  
  private buildErrorHtml(failure: TestFailure): string {
    const stackHtml = failure.stack
      ?.split("\n")
      .map(line => {
        const isCodeLine = line.trim().startsWith("at ");
        const color = isCodeLine ? "#666" : "#333";
        const fontWeight = isCodeLine ? "normal" : "bold";
        return `<div style="color: ${color}; font-weight: ${fontWeight}; font-family: var(--font-mono); font-size: 12px; margin: 2px 0;">${this.escapeHtml(line)}</div>`;
      })
      .join("") || "<em>No stack trace</em>";
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 30px;
      font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
      background: #f8d7da;
      color: #721c24;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border-left: 5px solid #dc3545;
    }
    h1 { margin-top: 0; color: #dc3545; font-size: 24px; }
    .test-name { font-family: var(--font-mono); background: #f8f9fa; padding: 8px 12px; border-radius: 4px; margin: 10px 0; }
    .error-message { 
      background: #f8d7da; 
      color: #721c24; 
      padding: 15px; 
      border-radius: 4px; 
      margin: 15px 0;
      font-weight: 500;
    }
    .stack-trace {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      padding: 15px;
      margin-top: 20px;
      overflow-x: auto;
    }
    .section-title { font-size: 14px; font-weight: 600; color: #666; margin-bottom: 10px; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="container">
    <h1>❌ Test Failure</h1>
    <div class="section-title">Test</div>
    <div class="test-name">${this.escapeHtml(failure.testName)}</div>
    <div class="section-title">Error Message</div>
    <div class="error-message">${this.escapeHtml(failure.message)}</div>
    <div class="section-title">Stack Trace</div>
    <div class="stack-trace">${stackHtml}</div>
  </div>
</body>
</html>
    `;
  }
  
  private parseStackTrace(
    stack: string | undefined,
    cwd: string
  ): { file: string; line: number; column: number; lines: Array<{ number: number; code: string; isErrorLine: boolean }> } | null {
    if (!stack) return null;
    
    const match = stack.match(/at\s+.+\s+\((.+?):(\d+):(\d+)\)/) ||
                  stack.match(/at\s+(.+?):(\d+):(\d+)/);
    
    if (!match) return null;
    
    const file = match[1].replace(cwd, "").replace(/^\//, "");
    const line = parseInt(match[2], 10);
    const column = parseInt(match[3], 10);
    
    // Try to read surrounding code
    try {
      const fs = require("fs");
      const content = fs.readFileSync(path.join(cwd, file), "utf-8");
      const lines = content.split("\n");
      
      const contextLines = [];
      const start = Math.max(0, line - 5);
      const end = Math.min(lines.length, line + 5);
      
      for (let i = start; i < end; i++) {
        contextLines.push({
          number: i + 1,
          code: lines[i],
          isErrorLine: i + 1 === line,
        });
      }
      
      return { file, line, column, lines: contextLines };
    } catch {
      return { file, line, column, lines: [] };
    }
  }
  
  private createFallbackErrorArtifact(failure: TestFailure): ErrorStateArtifact {
    return {
      id: this.generateId("error-fallback"),
      type: "error-state",
      description: `Test failure: ${failure.testName} (screenshot failed)`,
      timestamp: new Date().toISOString(),
      verificationClaim: `Test "${failure.testName}" failed`,
      confidence: 1.0,
      annotations: [
        this.createAnnotation("TEST", failure.testName, { color: "red" }),
        this.createAnnotation("ERROR", failure.message.substring(0, 100), { 
          color: "red", 
          severity: "error" 
        }),
      ],
      llmContext: `Test failure in ${failure.testName}:\n${failure.message}\n\n${failure.stack?.slice(0, 1000) || "No stack trace"}`,
      data: {
        errorType: "test-failure" as const,
        message: failure.message,
        stackTrace: failure.stack,
      },
    };
  }
  
  private formatForLLM(
    failure: TestFailure,
    codeContext: { file: string; line: number; lines: Array<{ number: number; code: string; isErrorLine: boolean }> } | null
  ): string {
    let context = `Test Failure: ${failure.testName}\n\n`;
    context += `Error: ${failure.message}\n\n`;
    
    if (codeContext) {
      context += `Location: ${codeContext.file}:${codeContext.line}\n\n`;
      context += `Code context:\n`;
      for (const line of codeContext.lines) {
        const marker = line.isErrorLine ? ">>> " : "    ";
        context += `${marker}${line.number}: ${line.code}\n`;
      }
      context += "\n";
    }
    
    context += `Stack trace:\n${failure.stack?.slice(0, 2000) || "N/A"}`;
    
    return context;
  }
  
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
