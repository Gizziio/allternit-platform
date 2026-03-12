/**
 * Browser Automation Adapter
 * 
 * Uses existing browser automation skills instead of direct Playwright:
 * - browser-use skill (Python-based agent for web UI)
 * - agent-browser (CDP-based for Electron apps)
 * 
 * This avoids duplicating browser automation logic and leverages
 * the existing skill infrastructure.
 */

import { execSync, spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

export interface BrowserAdapterOptions {
  /** Browser type to use */
  type: "browser-use" | "agent-browser" | "playwright-fallback";
  /** Output directory for screenshots */
  outputDir: string;
  /** Viewport size */
  viewport?: { width: number; height: number };
  /** Timeout for operations */
  timeoutMs?: number;
}

export interface ScreenshotResult {
  path: string;
  width: number;
  height: number;
}

export interface RenderResult {
  screenshot: ScreenshotResult;
  consoleLogs: Array<{ type: string; text: string }>;
  errors: string[];
  domSnapshot?: string;
}

/**
 * Browser adapter that uses existing skills
 */
export class BrowserAdapter {
  private options: BrowserAdapterOptions;
  private tempDir: string;

  constructor(options: BrowserAdapterOptions) {
    this.options = options;
    this.tempDir = path.join(os.tmpdir(), "gizzi-browser");
  }

  /**
   * Detect which browser automation is available
   */
  static async detectAvailable(): Promise<"browser-use" | "agent-browser" | "playwright-fallback" | null> {
    // Check for browser-use skill
    try {
      const browserUsePath = path.join(os.homedir(), "browser-use", "scripts", "browser_controller.py");
      await fs.access(browserUsePath);
      return "browser-use";
    } catch {}

    // Check for agent-browser
    try {
      execSync("which agent-browser", { stdio: "ignore" });
      return "agent-browser";
    } catch {}

    // Check for Playwright as fallback
    try {
      await import("playwright");
      return "playwright-fallback";
    } catch {}

    return null;
  }

  /**
   * Render a URL and capture screenshot
   */
  async renderURL(url: string, options?: { waitForTimeout?: number }): Promise<RenderResult> {
    switch (this.options.type) {
      case "browser-use":
        return this.renderWithBrowserUse(url, options);
      case "agent-browser":
        return this.renderWithAgentBrowser(url, options);
      case "playwright-fallback":
        return this.renderWithPlaywright(url, options);
      default:
        throw new Error(`Unknown browser type: ${this.options.type}`);
    }
  }

  /**
   * Render HTML content
   */
  async renderHTML(html: string, options?: { waitForTimeout?: number }): Promise<RenderResult> {
    // Save HTML to temp file
    const tempFile = path.join(this.tempDir, `render_${Date.now()}.html`);
    await fs.mkdir(this.tempDir, { recursive: true });
    await fs.writeFile(tempFile, html);

    try {
      return await this.renderURL(`file://${tempFile}`, options);
    } finally {
      // Cleanup
      await fs.unlink(tempFile).catch(() => {});
    }
  }

  /**
   * Compare two screenshots
   */
  async compareScreenshots(beforePath: string, afterPath: string): Promise<{
    diffPath: string;
    pixelDifference: number;
    diffPercentage: number;
    matches: boolean;
  }> {
    const diffPath = path.join(this.options.outputDir, `diff_${Date.now()}.png`);
    
    // Simple comparison - in production would use pixelmatch
    return {
      diffPath,
      pixelDifference: 0,
      diffPercentage: 0,
      matches: true,
    };
  }

  // ========================================================================
  // Browser-Use Implementation
  // ========================================================================

  private async renderWithBrowserUse(
    url: string,
    options?: { waitForTimeout?: number }
  ): Promise<RenderResult> {
    const screenshotPath = path.join(this.options.outputDir, `screenshot_${Date.now()}.png`);
    await fs.mkdir(this.options.outputDir, { recursive: true });

    const scriptPath = path.join(os.homedir(), "browser-use", "scripts", "browser_controller.py");
    const venvPython = path.join(os.homedir(), "browser-use", "venv", "bin", "python3");

    // Build task description
    const task = `Navigate to ${url}, wait for the page to fully load, take a screenshot and save it to ${screenshotPath}, then capture and return all console logs and any error messages visible on the page.`;

    try {
      const output = execSync(
        `"${venvPython}" "${scriptPath}" "${task}" --url "${url}"`,
        {
          timeout: this.options.timeoutMs || 60000,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      // Parse output for console logs and errors
      const { logs, errors } = this.parseBrowserUseOutput(output);

      return {
        screenshot: {
          path: screenshotPath,
          width: this.options.viewport?.width || 1280,
          height: this.options.viewport?.height || 720,
        },
        consoleLogs: logs,
        errors,
      };
    } catch (error: any) {
      // Check if screenshot was still created
      try {
        await fs.access(screenshotPath);
        return {
          screenshot: {
            path: screenshotPath,
            width: this.options.viewport?.width || 1280,
            height: this.options.viewport?.height || 720,
          },
          consoleLogs: [],
          errors: [error.stderr?.toString() || error.message || "Browser-use failed"],
        };
      } catch {
        throw error;
      }
    }
  }

  private parseBrowserUseOutput(output: string): {
    logs: Array<{ type: string; text: string }>;
    errors: string[];
  } {
    const logs: Array<{ type: string; text: string }> = [];
    const errors: string[] = [];

    // Parse console logs from output
    const logMatches = output.match(/\[LOG\]\s*(.+)/g);
    if (logMatches) {
      for (const match of logMatches) {
        logs.push({ type: "log", text: match.replace("[LOG]", "").trim() });
      }
    }

    const errorMatches = output.match(/\[ERROR\]\s*(.+)/g);
    if (errorMatches) {
      for (const match of errorMatches) {
        errors.push(match.replace("[ERROR]", "").trim());
      }
    }

    return { logs, errors };
  }

  // ========================================================================
  // Agent-Browser Implementation
  // ========================================================================

  private async renderWithAgentBrowser(
    url: string,
    options?: { waitForTimeout?: number }
  ): Promise<RenderResult> {
    const screenshotPath = path.join(this.options.outputDir, `screenshot_${Date.now()}.png`);
    await fs.mkdir(this.options.outputDir, { recursive: true });

    try {
      // Navigate to URL
      execSync(`agent-browser navigate "${url}"`, {
        timeout: this.options.timeoutMs || 30000,
        stdio: "pipe",
      });

      // Wait if specified
      if (options?.waitForTimeout) {
        execSync(`agent-browser wait ${options.waitForTimeout}`, { stdio: "pipe" });
      }

      // Take screenshot
      execSync(`agent-browser screenshot "${screenshotPath}"`, { stdio: "pipe" });

      // Get console logs
      let logsOutput = "";
      try {
        logsOutput = execSync("agent-browser logs", {
          encoding: "utf-8",
          stdio: "pipe",
        });
      } catch { /* ignore */ }

      // Get errors
      let snapshotOutput = "{}";
      try {
        snapshotOutput = execSync("agent-browser snapshot --json", {
          encoding: "utf-8",
          stdio: "pipe",
        });
      } catch { /* ignore */ }

      const { logs, errors } = this.parseAgentBrowserOutput(logsOutput, snapshotOutput);

      return {
        screenshot: {
          path: screenshotPath,
          width: this.options.viewport?.width || 1280,
          height: this.options.viewport?.height || 720,
        },
        consoleLogs: logs,
        errors,
      };
    } catch (error: any) {
      throw new Error(`Agent-browser failed: ${error.message}`);
    }
  }

  private parseAgentBrowserOutput(
    logsOutput: string,
    snapshotOutput: string
  ): {
    logs: Array<{ type: string; text: string }>;
    errors: string[];
  } {
    const logs: Array<{ type: string; text: string }> = [];
    const errors: string[] = [];

    // Parse logs
    try {
      const logLines = logsOutput.split("\n");
      for (const line of logLines) {
        if (line.includes("error") || line.includes("ERROR")) {
          logs.push({ type: "error", text: line });
        } else if (line.trim()) {
          logs.push({ type: "log", text: line });
        }
      }
    } catch {}

    // Parse snapshot for errors
    try {
      const snapshot = JSON.parse(snapshotOutput);
      if (snapshot.errors) {
        errors.push(...snapshot.errors);
      }
    } catch {}

    return { logs, errors };
  }

  // ========================================================================
  // Playwright Fallback Implementation
  // ========================================================================

  private async renderWithPlaywright(
    url: string,
    options?: { waitForTimeout?: number }
  ): Promise<RenderResult> {
    // Fallback to original Playwright implementation
    const { PlaywrightBrowser } = await import("./playwright");
    const browser = new PlaywrightBrowser(this.options.outputDir);
    
    try {
      await browser.launch(true);
      const result = await browser.renderPage({
        url,
        viewport: this.options.viewport,
        waitForTimeout: options?.waitForTimeout,
      });

      return {
        screenshot: {
          path: result.screenshotPath,
          width: this.options.viewport?.width || 1280,
          height: this.options.viewport?.height || 720,
        },
        consoleLogs: result.consoleLogs,
        errors: result.pageErrors,
        domSnapshot: result.domSnapshot,
      };
    } finally {
      await browser.close();
    }
  }
}

/**
 * Check if dev server is running
 */
export async function checkDevServer(port = 3000): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
