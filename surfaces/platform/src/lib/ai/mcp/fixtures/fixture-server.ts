/**
 * MCP Fixture Server - Real Working MCP Server with Interactive App
 * 
 * This is a REAL MCP server that demonstrates the complete flow:
 * 1. Server registers a tool with _meta.ui.resourceUri
 * 2. Client calls the tool
 * 3. Server returns result + resources/read for the UI
 * 4. HTML contains working AppBridge integration
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ============================================================================
// Interactive Counter App HTML with Real AppBridge
// ============================================================================

const COUNTER_APP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interactive Counter</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      padding: 20px;
    }
    .counter-card {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 24px;
      padding: 40px;
      text-align: center;
      min-width: 280px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    }
    h1 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: rgba(255,255,255,0.5);
      margin-bottom: 24px;
    }
    .count {
      font-size: 96px;
      font-weight: 200;
      line-height: 1;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #d4b08c 0%, #f7d9ba 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .label {
      font-size: 14px;
      color: rgba(255,255,255,0.4);
      margin-bottom: 32px;
    }
    .controls {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-bottom: 24px;
    }
    button {
      width: 56px;
      height: 56px;
      border: none;
      border-radius: 16px;
      font-size: 24px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-dec {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }
    .btn-dec:hover {
      background: rgba(239, 68, 68, 0.3);
      transform: scale(1.05);
    }
    .btn-inc {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }
    .btn-inc:hover {
      background: rgba(34, 197, 94, 0.3);
      transform: scale(1.05);
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .action-btn {
      width: auto;
      height: auto;
      padding: 12px 20px;
      font-size: 13px;
      font-weight: 500;
      background: rgba(212, 176, 140, 0.15);
      color: #d4b08c;
      border: 1px solid rgba(212, 176, 140, 0.2);
    }
    .action-btn:hover {
      background: rgba(212, 176, 140, 0.25);
    }
    .status {
      margin-top: 16px;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-family: monospace;
      background: rgba(0,0,0,0.3);
      color: rgba(255,255,255,0.4);
      opacity: 0;
      transition: opacity 0.3s;
    }
    .status.show {
      opacity: 1;
    }
    .bridge-status {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
      transition: background 0.3s;
    }
    .bridge-status.connected {
      background: #22c55e;
    }
  </style>
</head>
<body>
  <div class="bridge-status" id="bridgeStatus"></div>
  
  <div class="counter-card">
    <h1>Interactive Counter</h1>
    <div class="count" id="count">0</div>
    <div class="label">Current Value</div>
    
    <div class="controls">
      <button class="btn-dec" onclick="decrement()">−</button>
      <button class="btn-inc" onclick="increment()">+</button>
    </div>
    
    <div class="actions">
      <button class="action-btn" onclick="sendToChat()">
        📤 Send Value to Chat
      </button>
      <button class="action-btn" onclick="updateContext()">
        💾 Update Model Context
      </button>
      <button class="action-btn" onclick="reset()">
        🔄 Reset Counter
      </button>
    </div>
    
    <div class="status" id="status"></div>
  </div>

  <script>
    // Counter state
    let count = 0;
    const countEl = document.getElementById('count');
    const statusEl = document.getElementById('status');
    const bridgeStatusEl = document.getElementById('bridgeStatus');
    
    // AppBridge integration
    let bridge = null;
    let bridgeReady = false;
    
    // Initialize AppBridge
    function initBridge() {
      if (typeof window === 'undefined' || window.parent === window) {
        showStatus('Running standalone (no parent frame)');
        return;
      }
      
      // Check for AppBridge
      if (window.AppBridge) {
        bridge = window.AppBridge;
        bridgeReady = true;
        bridgeStatusEl.classList.add('connected');
        showStatus('AppBridge connected');
        
        // Notify host we're ready
        if (bridge.notify) {
          bridge.notify('ready', { value: count });
        }
      } else {
        // Fallback: wait for bridge or use postMessage
        showStatus('Waiting for AppBridge...');
        window.addEventListener('message', handleParentMessage);
        
        // Notify parent we're loaded
        window.parent.postMessage({ type: 'mcp-app-loaded', appId: 'counter' }, '*');
      }
    }
    
    function handleParentMessage(event) {
      if (event.data && event.data.type === 'appbridge-init') {
        bridgeReady = true;
        bridgeStatusEl.classList.add('connected');
        showStatus('AppBridge connected via postMessage');
      }
    }
    
    // Counter operations
    function increment() {
      count++;
      updateDisplay();
      notifyChange('incremented');
    }
    
    function decrement() {
      count--;
      updateDisplay();
      notifyChange('decremented');
    }
    
    function reset() {
      count = 0;
      updateDisplay();
      notifyChange('reset');
    }
    
    function updateDisplay() {
      countEl.textContent = count;
      countEl.style.transform = 'scale(1.1)';
      setTimeout(() => {
        countEl.style.transform = 'scale(1)';
      }, 150);
    }
    
    function notifyChange(action) {
      if (bridgeReady && bridge && bridge.notify) {
        bridge.notify('counter-changed', { action, value: count });
      }
    }
    
    // MCP App Protocol: ui/message
    function sendToChat() {
      const message = { 
        type: 'text', 
        text: 'The counter value is now ' + count 
      };
      
      if (bridgeReady && bridge && bridge.message) {
        // Use AppBridge API
        bridge.message('user', [message]);
        showStatus('Sent to chat via AppBridge');
      } else if (window.parent !== window) {
        // Fallback: postMessage
        window.parent.postMessage({
          type: 'mcp-app-message',
          role: 'user',
          content: [message]
        }, '*');
        showStatus('Sent to chat via postMessage');
      } else {
        showStatus('No parent frame to send to');
      }
    }
    
    // MCP App Protocol: ui/update-model-context
    function updateContext() {
      const context = { 
        counterValue: count,
        lastUpdated: new Date().toISOString()
      };
      
      if (bridgeReady && bridge && bridge.updateModelContext) {
        bridge.updateModelContext(context);
        showStatus('Context updated via AppBridge');
      } else if (window.parent !== window) {
        window.parent.postMessage({
          type: 'mcp-app-update-context',
          context: context
        }, '*');
        showStatus('Context updated via postMessage');
      } else {
        showStatus('No parent frame to update context');
      }
    }
    
    function showStatus(msg) {
      statusEl.textContent = msg;
      statusEl.classList.add('show');
      setTimeout(() => {
        statusEl.classList.remove('show');
      }, 3000);
    }
    
    // Initialize on load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initBridge);
    } else {
      initBridge();
    }
  </script>
</body>
</html>`;

// ============================================================================
// MCP Server Implementation
// ============================================================================

export interface FixtureServerOptions {
  name?: string;
  version?: string;
}

export function createFixtureServer(options: FixtureServerOptions = {}) {
  const serverName = options.name || "a2r-mcp-apps-fixture";
  const serverVersion = options.version || "1.0.0";
  
  const server = new Server(
    {
      name: serverName,
      version: serverVersion,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        // MCP Apps extension capability
        experimental: {
          "mcp-apps": {
            version: "2025-03-26",
            supportedSchemas: ["ui"],
          },
        },
      },
    }
  );

  // Tool call tracking for tests
  const toolCalls: Array<{ name: string; args: unknown; timestamp: number }> = [];
  
  // ============================================================================
  // Tools
  // ============================================================================
  
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // Standard tool (no UI)
        {
          name: "echo",
          description: "Echo back the input message",
          inputSchema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Message to echo" },
            },
            required: ["message"],
          },
        },
        // MCP App tool with interactive UI
        {
          name: "interactive_counter",
          description: "An interactive counter app that demonstrates MCP Apps. Users can increment/decrement and send results back to the chat.",
          inputSchema: {
            type: "object",
            properties: {
              initialValue: { 
                type: "number", 
                description: "Starting value for the counter",
                default: 0 
              },
            },
          },
          // MCP Apps metadata - THIS IS THE KEY
          _meta: {
            ui: {
              // The resource URI that will be fetched for the UI
              resourceUri: "ui:///counter-app",
              // App display preferences
              prefersBorder: true,
              title: "Interactive Counter",
            },
            // Visibility: who can use this tool
            visibility: "app-only", // Only the app can call this
          },
        },
        // Tool that returns HTML directly (for comparison)
        {
          name: "render_html",
          description: "Render arbitrary HTML content",
          inputSchema: {
            type: "object",
            properties: {
              html: { type: "string", description: "HTML content to render" },
              title: { type: "string", description: "Title for the app" },
            },
            required: ["html"],
          },
          _meta: {
            ui: {
              resourceUri: "ui:///dynamic-html",
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    toolCalls.push({ name, args, timestamp: Date.now() });
    
    switch (name) {
      case "echo": {
        const message = (args as { message: string }).message;
        return {
          content: [
            { type: "text", text: `Echo: ${message}` },
          ],
        };
      }
      
      case "interactive_counter": {
        const initialValue = (args as { initialValue?: number }).initialValue ?? 0;
        
        // Return the result - the UI comes from resources/read
        return {
          content: [
            { 
              type: "text", 
              text: `Interactive counter initialized with value: ${initialValue}\n\nThe counter app is now ready. Use the +/- buttons to adjust the value, then send it back to the chat or update the model context.` 
            },
          ],
          // MCP Apps extension: tell client which resource to fetch for UI
          _meta: {
            ui: {
              resourceUri: "ui:///counter-app",
              context: { initialValue },
            },
          },
        };
      }
      
      case "render_html": {
        const { html, title } = args as { html: string; title?: string };
        return {
          content: [
            { type: "text", text: `Rendering HTML content${title ? `: ${title}` : ''}` },
          ],
          _meta: {
            ui: {
              resourceUri: "ui:///dynamic-html",
              html, // Inline HTML for dynamic content
            },
          },
        };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  // ============================================================================
  // Resources (for MCP Apps UI)
  // ============================================================================
  
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "ui:///counter-app",
          name: "Interactive Counter App",
          mimeType: "text/html",
          description: "A fully interactive counter app with AppBridge integration",
        },
        {
          uri: "ui:///dynamic-html",
          name: "Dynamic HTML Renderer",
          mimeType: "text/html",
          description: "Renders arbitrary HTML content",
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    
    if (uri === "ui:///counter-app") {
      return {
        contents: [
          {
            uri,
            mimeType: "text/html",
            text: COUNTER_APP_HTML,
            // MCP Apps extension metadata
            _meta: {
              app: {
                title: "Interactive Counter",
                description: "A counter app that can send messages back to the chat",
                prefersBorder: true,
                // CSP configuration
                csp: {
                  defaultSrc: ["'self'"],
                  scriptSrc: ["'self'", "'unsafe-inline'"],
                  styleSrc: ["'self'", "'unsafe-inline'"],
                  connectDomains: [],
                },
                // Permissions for the iframe
                permissions: {
                  fullscreen: true,
                },
              },
            },
          },
        ],
      };
    }
    
    if (uri === "ui:///dynamic-html") {
      // For dynamic HTML, the content is provided in the tool result
      return {
        contents: [
          {
            uri,
            mimeType: "text/html",
            text: "<!-- Dynamic HTML placeholder - actual content from tool result -->",
          },
        ],
      };
    }
    
    throw new Error(`Resource not found: ${uri}`);
  });

  return {
    server,
    getToolCalls: () => [...toolCalls],
    clearToolCalls: () => { toolCalls.length = 0; },
  };
}

// ============================================================================
// Run Server Standalone
// ============================================================================

if (require.main === module) {
  const { server } = createFixtureServer();
  const transport = new StdioServerTransport();
  
  server.connect(transport).then(() => {
    console.error("MCP Fixture Server running on stdio");
    console.error("Tools: echo, interactive_counter, render_html");
    console.error("Resources: ui:///counter-app, ui:///dynamic-html");
  });
}

export default createFixtureServer;
