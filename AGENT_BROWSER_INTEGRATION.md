# Agent Browser Integration Guide

**Target:** https://github.com/vercel-labs/agent-browser  
**Integration Date:** February 26, 2026  
**Status:** Ready to Implement

---

## 📋 OVERVIEW

**agent-browser** is a browser automation CLI tool optimized for AI agents. It provides:
- Headless browser control (Playwright-based)
- Snapshot-based interaction with element refs (`@e1`, `@e2`)
- Semantic locators (find by role, label, text)
- Annotated screenshots
- Session management with persistent profiles
- Security features (domain allowlists, action policies)

**This replaces/enhances** the existing browser automation in:
- `3-adapters/ts/browser-tools/`
- `6-ui/a2r-platform/src/services/browserEngine.ts`
- `6-ui/a2r-platform/src/capsules/browser/`

---

## 🎯 INTEGRATION OPTIONS

### Option 1: CLI Tool Integration (RECOMMENDED - Fastest)

**Approach:** Call `agent-browser` CLI as an external tool via existing tool gateway

**Pros:**
- ✅ No code changes to agent-browser
- ✅ Uses official supported interface
- ✅ Fast implementation (1-2 days)
- ✅ Automatic updates when agent-browser updates

**Cons:**
- ⚠️ CLI overhead for each command
- ⚠️ Less control over browser lifecycle

**Implementation Location:**
```
tools/agent-browser/
├── mod.ts              # Tool entrypoint
├── agent-browser.ts    # CLI wrapper
└── README.md
```

---

### Option 2: Node.js Library Integration

**Approach:** Import `agent-browser` as a Node.js library and create a service

**Pros:**
- ✅ Better performance (persistent daemon)
- ✅ More control over sessions
- ✅ Can expose advanced features

**Cons:**
- ⚠️ More complex integration
- ⚠️ Need to manage daemon lifecycle

**Implementation Location:**
```
4-services/browser-automation/
├── src/
│   ├── service.ts      # Browser automation service
│   ├── session.ts      # Session management
│   └── index.ts
├── package.json
└── README.md
```

---

### Option 3: Rust Native Integration (Most Complex)

**Approach:** Use agent-browser's Rust CLI via subprocess or create Rust bindings

**Pros:**
- ✅ Best performance
- ✅ Matches existing Rust tool pattern

**Cons:**
- ⚠️ Most complex
- ⚠️ Requires Rust FFI or subprocess management

**Implementation Location:**
```
1-kernel/tools/agent-browser-driver/
├── src/lib.rs
├── Cargo.toml
└── README.md
```

---

## 🚀 RECOMMENDED IMPLEMENTATION: Option 1 (CLI Tool)

### Step 1: Install agent-browser

```bash
# Global install (recommended)
npm install -g agent-browser

# Download Chromium
agent-browser install

# Verify installation
agent-browser --version
```

---

### Step 2: Create Tool Definition

**File:** `tools/agent-browser/mod.ts`

```typescript
/**
 * Agent Browser Tool - Browser Automation for AI Agents
 * 
 * Provides headless browser control via agent-browser CLI
 * https://github.com/vercel-labs/agent-browser
 */

import { z } from "zod";
import { $ } from "bun";

// Tool metadata
export const tool = {
  id: "agent-browser.automation",
  title: "Agent Browser Automation",
  description: "Control a headless browser for web automation, screenshots, and data extraction",
  kind: "write",
  safety_level: "caution",
  version: "1.0.0",
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
  ]),
  url: z.string().optional().describe("URL to navigate to (for 'open' action)"),
  selector: z.string().optional().describe("Element selector (e.g., '@e2', 'button.submit', '#login')"),
  value: z.string().optional().describe("Value to fill/type"),
  path: z.string().optional().describe("File path for screenshot"),
  timeout: z.number().optional().describe("Timeout in milliseconds"),
  session_id: z.string().optional().describe("Session ID for persistent session"),
  profile: z.string().optional().describe("Profile path for persistent cookies/login"),
});

// Output schema
export const outputSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  screenshot: z.string().optional().describe("Base64 screenshot if applicable"),
  snapshot: z.any().optional().describe("Accessibility tree snapshot"),
});

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

// Main execution function
export async function execute(input: Input): Promise<Output> {
  try {
    const { action, url, selector, value, path, timeout, session_id, profile } = input;

    // Build agent-browser command
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
          return { success: false, error: "URL required for 'open' action" };
        }
        args.push("open", url);
        break;

      case "snapshot":
        args.push("snapshot", "--json");
        break;

      case "click":
        if (!selector) {
          return { success: false, error: "Selector required for 'click' action" };
        }
        args.push("click", selector);
        break;

      case "fill":
      case "type":
        if (!selector || !value) {
          return { success: false, error: "Selector and value required for 'fill/type' action" };
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
          return { success: false, error: "Selector required for 'get_*' action" };
        }
        args.push("get", action.replace("get_", ""), selector);
        break;

      case "wait":
        if (!timeout && !selector) {
          return { success: false, error: "Timeout or selector required for 'wait' action" };
        }
        if (timeout) {
          args.push("wait", `${timeout}ms`);
        } else {
          args.push("wait", selector!);
        }
        break;

      case "find":
        if (!selector) {
          return { success: false, error: "Selector required for 'find' action" };
        }
        args.push("find", selector);
        break;

      case "close":
        args.push("close");
        break;

      default:
        return { success: false, error: `Unknown action: ${action}` };
    }

    // Execute command
    const result = await $`agent-browser ${args}`.quiet().nothrow();

    if (result.exitCode !== 0) {
      return {
        success: false,
        error: `agent-browser failed: ${result.stderr.toString()}`,
      };
    }

    // Parse output based on action
    let data: any = null;
    let screenshot: string | undefined = undefined;
    let snapshot: any = undefined;

    if (action === "snapshot") {
      snapshot = JSON.parse(result.stdout.toString());
    } else if (action === "screenshot" && path) {
      // Read screenshot file and convert to base64
      const fs = await import("fs");
      screenshot = fs.readFileSync(path).toString("base64");
    } else if (["get_text", "get_html", "get_value"].includes(action)) {
      data = result.stdout.toString().trim();
    }

    return {
      success: true,
      data,
      screenshot,
      snapshot,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Tool registration
export default {
  ...tool,
  inputs_schema: inputSchema,
  outputs_schema: outputSchema,
  execute,
};
```

---

### Step 3: Register Tool in Registry

**File:** `tools/tool_registry.json`

Add this entry to the `tools` array:

```json
{
  "id": "agent-browser.automation",
  "title": "Agent Browser Automation",
  "kind": "write",
  "safety_level": "caution",
  "entrypoint": "tools/agent-browser/mod.ts",
  "inputs_schema": {
    "type": "object",
    "required": ["action"],
    "properties": {
      "action": {
        "type": "string",
        "enum": ["open", "snapshot", "click", "fill", "type", "screenshot", "get_text", "get_html", "get_value", "wait", "find", "close"]
      },
      "url": {
        "type": "string",
        "description": "URL to navigate to (for 'open' action)"
      },
      "selector": {
        "type": "string",
        "description": "Element selector (e.g., '@e2', 'button.submit', '#login')"
      },
      "value": {
        "type": "string",
        "description": "Value to fill/type"
      },
      "path": {
        "type": "string",
        "description": "File path for screenshot"
      },
      "timeout": {
        "type": "number",
        "description": "Timeout in milliseconds"
      },
      "session_id": {
        "type": "string",
        "description": "Session ID for persistent session"
      },
      "profile": {
        "type": "string",
        "description": "Profile path for persistent cookies/login"
      }
    }
  },
  "outputs_schema": {
    "type": "object",
    "properties": {
      "success": { "type": "boolean" },
      "data": { "type": "object" },
      "error": { "type": "string" },
      "screenshot": { "type": "string" },
      "snapshot": { "type": "object" }
    }
  },
  "preconditions": ["WIH_VALID", "TASK_RUNNING"],
  "postconditions": ["BROWSER_STATE_UPDATED"],
  "side_effects": ["browser_navigation", "dom_modification", "screenshot_capture"]
}
```

---

### Step 4: Add to Tool Gateway

**File:** `7-apps/api/src/main.rs` (or wherever tool gateway is initialized)

The tool will be automatically loaded from the registry. No additional code changes needed if using the dynamic tool loading system.

---

### Step 5: Usage Examples

#### Basic Navigation
```typescript
// Open a website
await execute({ action: "open", url: "https://example.com" });

// Get snapshot with element refs
const snapshot = await execute({ action: "snapshot" });
// Returns: { snapshot: { elements: [{ ref: "@e1", role: "button", text: "Click me" }] } }

// Click element by ref
await execute({ action: "click", selector: "@e2" });

// Fill form field
await execute({ action: "fill", selector: "@e3", value: "test@example.com" });
```

#### Screenshot
```typescript
// Take screenshot
const result = await execute({ 
  action: "screenshot", 
  path: "/tmp/screenshot.png" 
});
// Returns: { screenshot: "base64_encoded_image..." }
```

#### Data Extraction
```typescript
// Get text from element
const text = await execute({ 
  action: "get_text", 
  selector: "h1.title" 
});

// Get HTML
const html = await execute({ 
  action: "get_html", 
  selector: "#content" 
});
```

#### Session Management
```typescript
// Use persistent session (cookies/login saved)
await execute({ 
  action: "open", 
  url: "https://myapp.com",
  profile: "~/.myapp-profile"
});

// Use isolated session
await execute({ 
  action: "open", 
  url: "https://example.com",
  session_id: "agent1"
});
```

---

## 🔧 ADVANCED: Option 2 (Node.js Service)

If you need better performance and control, create a dedicated service:

### File: `4-services/browser-automation/src/service.ts`

```typescript
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import WebSocket from 'ws';

export class BrowserAutomationService extends EventEmitter {
  private daemonProcess: any = null;
  private wsUrl: string | null = null;
  private ws: WebSocket | null = null;

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Start agent-browser daemon
      this.daemonProcess = spawn('agent-browser', ['daemon'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.daemonProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        // Parse WebSocket URL from daemon output
        const match = output.match(/WebSocket: (ws:\/\/.*)/);
        if (match) {
          this.wsUrl = match[1];
          this.connectWebSocket().then(resolve).catch(reject);
        }
      });

      this.daemonProcess.stderr.on('data', (data: Buffer) => {
        console.error('Daemon error:', data.toString());
      });
    });
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.wsUrl) return reject(new Error('No WebSocket URL'));

      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log('Connected to browser daemon');
        resolve();
      });

      this.ws.on('error', reject);
    });
  }

  async execute(action: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws) return reject(new Error('Not connected'));

      const messageId = Date.now().toString();
      
      this.ws.once(`message:${messageId}`, (data: any) => {
        resolve(data);
      });

      this.ws.send(JSON.stringify({
        id: messageId,
        action,
        params,
      }));

      // Timeout after 30 seconds
      setTimeout(() => {
        reject(new Error('Action timeout'));
      }, 30000);
    });
  }

  async stop(): Promise<void> {
    if (this.ws) {
      this.ws.close();
    }
    if (this.daemonProcess) {
      this.daemonProcess.kill();
    }
  }
}

export const browserService = new BrowserAutomationService();
```

---

## 📊 COMPARISON: agent-browser vs Existing Browser Tools

| Feature | agent-browser | Existing (browser-tools) |
|---------|--------------|-------------------------|
| **Engine** | Playwright + Rust CLI | Playwright (Node.js) |
| **Element Refs** | ✅ `@e1`, `@e2` (deterministic) | ⚠️ XPath/CSS selectors |
| **Semantic Locators** | ✅ Role, label, text, placeholder | ⚠️ Limited |
| **Annotated Screenshots** | ✅ Built-in | ❌ Manual |
| **Session Management** | ✅ Built-in with encryption | ⚠️ Manual |
| **Security Features** | ✅ Domain allowlist, policies | ⚠️ Manual |
| **Cloud Providers** | ✅ Browserbase, Kernel, iOS | ❌ None |
| **CDP Mode** | ✅ Connect to existing Chrome | ❌ None |
| **Streaming** | ✅ WebSocket viewport | ❌ None |
| **Integration Effort** | ✅ Low (CLI) | N/A (already integrated) |

---

## ✅ RECOMMENDATION

**Use Option 1 (CLI Tool Integration)** because:

1. **Fastest implementation** - 1-2 days vs 1-2 weeks
2. **Official support** - Uses maintained interface
3. **No breaking changes** - Existing browser tools continue to work
4. **Progressive enhancement** - Can migrate to Option 2 later if needed
5. **Matches existing pattern** - Same as other tools in `tools/` directory

---

## 📝 NEXT STEPS

1. **Install agent-browser globally**
   ```bash
   npm install -g agent-browser
   agent-browser install
   ```

2. **Create tool files**
   ```bash
   mkdir -p tools/agent-browser
   # Create mod.ts with code from Step 2
   ```

3. **Update tool registry**
   ```bash
   # Add entry to tools/tool_registry.json
   ```

4. **Test the tool**
   ```bash
   # Via TUI
   /tools execute agent-browser.automation '{"action":"open","url":"https://example.com"}'
   
   # Via API
   curl -X POST http://localhost:3000/api/v1/tools/execute \
     -H "Content-Type: application/json" \
     -d '{"tool_name":"agent-browser.automation","parameters":{"action":"open","url":"https://example.com"}}'
   ```

5. **Update documentation**
   - Add to `tools/README.md`
   - Update `6-ui/a2r-platform` docs

---

## 🔒 SECURITY CONSIDERATIONS

1. **Domain Allowlist** - Configure allowed domains in tool preconditions
2. **Action Policies** - Gate destructive actions (click, fill) via policy engine
3. **Session Isolation** - Use `--session` flag for isolated browser contexts
4. **Output Limits** - Limit screenshot/text extraction size to prevent context flooding
5. **Authentication Vault** - Store credentials encrypted, reference by name

Example policy configuration:
```json
{
  "tool_id": "agent-browser.automation",
  "domain_allowlist": ["example.com", "myapp.com"],
  "blocked_actions": ["fill", "click"],
  "require_approval_for": ["fill", "click"],
  "output_limit_bytes": 1048576
}
```

---

**End of Integration Guide**
