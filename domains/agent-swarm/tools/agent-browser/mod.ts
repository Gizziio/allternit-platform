/**
 * Agent Browser Tool - Browser Automation for AI Agents
 * 
 * Provides headless browser control via agent-browser CLI
 * https://github.com/vercel-labs/agent-browser
 * 
 * @module tools/agent-browser
 */

import { z } from "zod";

// Tool metadata
export const tool = {
  id: "agent-browser.automation",
  title: "Agent Browser Automation",
  description: "Control a headless browser for web automation, screenshots, and data extraction. Optimized for AI agents with snapshot-based interaction and semantic locators.",
  kind: "write" as const,
  safety_level: "caution" as const,
  version: "1.0.0",
  tags: ["browser", "automation", "playwright", "web", "screenshot"],
  author: "Allternit",
  license: "Apache-2.0",
};

// Input schema
export const inputSchema = z.object({
  action: z.enum([
    "open",
    "snapshot",
    "click",
    "fill",
    "type",
    "screenshot",
    "get_text",
    "get_html",
    "get_value",
    "wait",
    "find",
    "close",
  ]).describe("Browser action to perform"),
  
  url: z.string().url().optional().describe("URL to navigate to (for 'open' action)"),
  
  selector: z.string().optional().describe("Element selector (e.g., '@e2', 'button.submit', '#login', 'role=button')"),
  
  value: z.string().optional().describe("Value to fill/type into input field"),
  
  path: z.string().optional().describe("File path for screenshot (e.g., '/tmp/screenshot.png')"),
  
  timeout: z.number().min(0).max(60000).optional().describe("Timeout in milliseconds (default: 30000)"),
  
  session_id: z.string().optional().describe("Session ID for persistent browser session"),
  
  profile: z.string().optional().describe("Profile path for persistent cookies/login (e.g., '~/.myapp-profile')"),
  
  json: z.boolean().optional().default(true).describe("Return JSON output (default: true)"),
});

// Output schema
export const outputSchema = z.object({
  success: z.boolean().describe("Whether the action succeeded"),
  
  data: z.any().optional().describe("Action-specific data (text, HTML, values)"),
  
  error: z.string().optional().describe("Error message if action failed"),
  
  screenshot: z.string().optional().describe("Base64-encoded screenshot (if applicable)"),
  
  snapshot: z.object({
    elements: z.array(z.object({
      ref: z.string(),
      role: z.string(),
      text: z.string().optional(),
      label: z.string().optional(),
    })).optional(),
  }).optional().describe("Accessibility tree snapshot with element refs"),
  
  execution_time_ms: z.number().optional().describe("Execution time in milliseconds"),
});

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

/**
 * Execute agent-browser CLI command
 */
async function runAgentBrowser(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    // Dynamically import Bun's shell API
    const { $ } = await import("bun");
    
    const result = await $`agent-browser ${args}`.quiet().nothrow();
    
    return {
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
      exitCode: result.exitCode,
    };
  } catch (error) {
    // Fallback to child_process if Bun not available
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    
    try {
      const command = `agent-browser ${args.join(" ")}`;
      const { stdout, stderr } = await execAsync(command);
      return {
        stdout,
        stderr,
        exitCode: 0,
      };
    } catch (e) {
      const err = e as any;
      return {
        stdout: err.stdout || "",
        stderr: err.stderr || err.message,
        exitCode: err.code || 1,
      };
    }
  }
}

/**
 * Main execution function
 */
export async function execute(input: Input): Promise<Output> {
  const startTime = Date.now();
  
  try {
    const { action, url, selector, value, path, timeout, session_id, profile, json } = input;

    // Build agent-browser command arguments
    const args: string[] = [];

    // Add session/profile if specified
    if (session_id) {
      args.push("--session", session_id);
    }
    if (profile) {
      args.push("--profile", profile);
    }

    // Build command based on action
    switch (action) {
      case "open":
        if (!url) {
          return { success: false, error: "URL required for 'open' action", execution_time_ms: Date.now() - startTime };
        }
        args.push("open", url);
        break;

      case "snapshot":
        args.push("snapshot", json ? "--json" : "");
        break;

      case "click":
        if (!selector) {
          return { success: false, error: "Selector required for 'click' action", execution_time_ms: Date.now() - startTime };
        }
        args.push("click", selector);
        break;

      case "fill":
      case "type":
        if (!selector || !value) {
          return { success: false, error: "Selector and value required for 'fill/type' action", execution_time_ms: Date.now() - startTime };
        }
        args.push(action, selector, value);
        break;

      case "screenshot":
        args.push("screenshot");
        if (path) {
          args.push(path);
        }
        break;

      case "get_text":
      case "get_html":
      case "get_value":
        if (!selector) {
          return { success: false, error: "Selector required for 'get_*' action", execution_time_ms: Date.now() - startTime };
        }
        args.push("get", action.replace("get_", ""), selector);
        break;

      case "wait":
        if (!timeout && !selector) {
          return { success: false, error: "Timeout or selector required for 'wait' action", execution_time_ms: Date.now() - startTime };
        }
        if (timeout) {
          args.push("wait", `${timeout}ms`);
        } else {
          args.push("wait", selector!);
        }
        break;

      case "find":
        if (!selector) {
          return { success: false, error: "Selector required for 'find' action", execution_time_ms: Date.now() - startTime };
        }
        args.push("find", selector);
        break;

      case "close":
        args.push("close");
        break;

      default:
        return { success: false, error: `Unknown action: ${action}`, execution_time_ms: Date.now() - startTime };
    }

    // Execute command
    const result = await runAgentBrowser(args);

    if (result.exitCode !== 0) {
      return {
        success: false,
        error: `agent-browser failed: ${result.stderr}`,
        execution_time_ms: Date.now() - startTime,
      };
    }

    // Parse output based on action
    let data: any = null;
    let screenshot: string | undefined = undefined;
    let snapshot: any = undefined;

    if (action === "snapshot") {
      try {
        snapshot = JSON.parse(result.stdout);
      } catch (e) {
        return {
          success: false,
          error: `Failed to parse snapshot JSON: ${(e as Error).message}`,
          execution_time_ms: Date.now() - startTime,
        };
      }
    } else if (action === "screenshot" && path) {
      // Read screenshot file and convert to base64
      const fs = await import("fs");
      try {
        const imageBuffer = fs.readFileSync(path);
        screenshot = imageBuffer.toString("base64");
      } catch (e) {
        return {
          success: false,
          error: `Failed to read screenshot file: ${(e as Error).message}`,
          execution_time_ms: Date.now() - startTime,
        };
      }
    } else if (["get_text", "get_html", "get_value"].includes(action)) {
      data = result.stdout.trim();
    }

    return {
      success: true,
      data,
      screenshot,
      snapshot,
      execution_time_ms: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      execution_time_ms: Date.now() - startTime,
    };
  }
}

// Tool registration export
export default {
  ...tool,
  inputs_schema: inputSchema,
  outputs_schema: outputSchema,
  execute,
};
