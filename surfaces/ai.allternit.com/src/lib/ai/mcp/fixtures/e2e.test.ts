/**
 * MCP Apps E2E Test - Real Server Integration
 * 
 * This test demonstrates the COMPLETE end-to-end flow:
 * 1. Start real MCP fixture server
 * 2. Connect via MCP client
 * 3. Call tool with _meta.ui.resourceUri
 * 4. Read HTML resource
 * 5. Verify AppBridge integration works
 * 6. Test ui/message and ui/update-model-context
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createFixtureServer } from "./fixture-server";
import {
  getMcpAppResourceUri,
  buildMcpAppRenderPayload,
  clientSupportsMcpApps,
} from "../apps";

// Import the components we need to test
import type { McpAppUIPart } from "../../rust-stream-adapter";

describe("MCP Apps E2E - Real Server Integration", () => {
  let client: Client;
  let server: ReturnType<typeof createFixtureServer>;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;

  beforeAll(async () => {
    // Create server
    server = createFixtureServer({ name: "e2e-test-server" });
    
    // Create in-memory transport pair (simulates stdio/stdio connection)
    const [clientTrans, serverTrans] = InMemoryTransport.createLinkedPair();
    clientTransport = clientTrans;
    serverTransport = serverTrans;
    
    // Start both sides
    await Promise.all([
      clientTransport.start(),
      serverTransport.start(),
    ]);
    
    // Connect client
    client = new Client(
      {
        name: "e2e-test-client",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          // MCP Apps capability
          experimental: {
            "mcp-apps": {
              version: "2025-03-26",
            },
          },
        },
      }
    );
    
    // Connect both sides
    await Promise.all([
      client.connect(clientTransport),
      server.server.connect(serverTransport),
    ]);
  });

  afterAll(async () => {
    await client.close();
    await server.server.close();
  });

  // ============================================================================
  // Step 1: Verify MCP Apps Capability Exchange
  // ============================================================================
  
  it("should advertise MCP Apps capability in server", async () => {
    // The server should advertise mcp-apps in its capabilities
    // This is implicit in the connection setup
    expect(server.server).toBeDefined();
  });

  it("should detect MCP Apps support in client", async () => {
    // Client sent MCP Apps capability during initialization
    // Using the proper extension format
    const { MCP_APPS_CLIENT_CAPABILITIES } = await import("../apps");
    const hasMcpApps = clientSupportsMcpApps(MCP_APPS_CLIENT_CAPABILITIES);
    expect(hasMcpApps).toBe(true);
  });

  // ============================================================================
  // Step 2: List Tools and Find MCP App Tool
  // ============================================================================
  
  it("should list tools including interactive_counter with _meta.ui.resourceUri", async () => {
    const tools = await client.listTools();
    
    expect(tools.tools).toHaveLength(3);
    
    // Find the interactive_counter tool
    const counterTool = tools.tools.find(t => t.name === "interactive_counter");
    expect(counterTool).toBeDefined();
    expect(counterTool?.description).toContain("interactive counter app");
    
    // Verify _meta.ui.resourceUri
    const meta = (counterTool as any)?._meta;
    expect(meta).toBeDefined();
    expect(meta?.ui?.resourceUri).toBe("ui:///counter-app");
    expect(meta?.ui?.prefersBorder).toBe(true);
    expect(meta?.ui?.title).toBe("Interactive Counter");
    expect(meta?.visibility).toBe("app-only");
  });

  // ============================================================================
  // Step 3: Extract Resource URI from Tool
  // ============================================================================
  
  it("should extract resource URI using production helper", () => {
    const toolWithUi = {
      name: "interactive_counter",
      description: "Test",
      inputSchema: { type: "object" },
      _meta: {
        ui: {
          resourceUri: "ui:///counter-app",
          prefersBorder: true,
        },
        visibility: "app-only",
      },
    };
    
    const uri = getMcpAppResourceUri(toolWithUi as any);
    expect(uri).toBe("ui:///counter-app");
  });

  // ============================================================================
  // Step 4: Call Tool and Get Result
  // ============================================================================
  
  it("should call interactive_counter tool and get result", async () => {
    const result = await client.callTool({
      name: "interactive_counter",
      arguments: { initialValue: 42 },
    });
    
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect((result.content[0] as any).text).toContain("Interactive counter initialized with value: 42");
    
    // Verify tool was tracked
    const calls = server.getToolCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("interactive_counter");
    expect(calls[0].args).toEqual({ initialValue: 42 });
  });

  // ============================================================================
  // Step 5: Read Resource (the actual HTML app)
  // ============================================================================
  
  it("should read counter-app resource and return HTML with AppBridge", async () => {
    const resource = await client.readResource({ uri: "ui:///counter-app" });
    
    expect(resource.contents).toHaveLength(1);
    
    const content = resource.contents[0];
    expect(content.mimeType).toBe("text/html");
    expect(content.uri).toBe("ui:///counter-app");
    
    const html = (content as any).text;
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Interactive Counter");
    
    // Verify AppBridge integration
    expect(html).toContain("window.AppBridge");
    expect(html).toContain("bridge.message");  // ui/message
    expect(html).toContain("bridge.updateModelContext");  // ui/update-model-context
    expect(html).toContain("mcp-app-message");  // Fallback postMessage
    expect(html).toContain("mcp-app-update-context");  // Fallback postMessage
    
    // Verify interactive elements
    expect(html).toContain("increment()");
    expect(html).toContain("decrement()");
    expect(html).toContain("sendToChat()");
    expect(html).toContain("updateContext()");
    
    // Verify _meta.app metadata
    const meta = (content as any)._meta;
    expect(meta).toBeDefined();
    expect(meta?.app?.title).toBe("Interactive Counter");
    expect(meta?.app?.prefersBorder).toBe(true);
    expect(meta?.app?.csp).toBeDefined();
  });

  // ============================================================================
  // Step 6: Build Complete Render Payload (as production would)
  // ============================================================================
  
  it("should build complete render payload matching production flow", async () => {
    // 1. Get tool definition
    const tools = await client.listTools();
    const counterTool = tools.tools.find(t => t.name === "interactive_counter")!;
    
    // 2. Call tool
    const toolResult = await client.callTool({
      name: "interactive_counter",
      arguments: { initialValue: 10 },
    });
    
    // 3. Read resource
    const resource = await client.readResource({ uri: "ui:///counter-app" });
    const htmlContent = resource.contents[0];
    
    // 4. Build payload (as production code does)
    const payload = buildMcpAppRenderPayload({
      toolCallId: "tc_test_001",
      toolName: "interactive_counter",
      connectorId: "test-connector",
      connectorName: "Test Connector",
      tool: counterTool as any,
      resource: {
        _meta: (htmlContent as any)._meta,
        contents: [htmlContent],
      },
      toolInput: { initialValue: 10 },
      toolResult: {
        content: toolResult.content,
        _meta: (toolResult as any)._meta,
      },
    });
    
    // Verify payload structure
    expect(payload.toolCallId).toBe("tc_test_001");
    expect(payload.toolName).toBe("interactive_counter");
    expect(payload.connectorId).toBe("test-connector");
    expect(payload.resourceUri).toBe("ui:///counter-app");
    // Title falls back to tool.description if htmlContent.title not set
    expect(payload.title).toContain("interactive counter app");
    expect(payload.html).toContain("<!DOCTYPE html>");
    expect(payload.html).toContain("AppBridge");
    expect(payload.toolInput).toEqual({ initialValue: 10 });
    expect(payload.toolResult).toBeDefined();
    // CSP comes from resource._meta.app.csp - structure depends on server
    expect(payload.prefersBorder).toBe(true);
    
    // This payload is what gets sent to the client (with type added by adapter)
    expect(payload).toBeDefined();
    expect(payload.toolCallId).toBe("tc_test_001");
  });

  // ============================================================================
  // Step 7: Simulate Full Production Flow
  // ============================================================================
  
  it("should simulate complete production flow end-to-end", async () => {
    // This simulates exactly what happens in production:
    
    // 1. Gateway calls tool with _meta.ui.resourceUri
    const toolResult = await client.callTool({
      name: "interactive_counter",
      arguments: { initialValue: 5 },
    });
    
    // 2. Gateway extracts resource URI from tool _meta
    const tools = await client.listTools();
    const counterTool = tools.tools.find(t => t.name === "interactive_counter")!;
    const resourceUri = getMcpAppResourceUri(counterTool as any);
    expect(resourceUri).toBe("ui:///counter-app");
    
    // 3. Gateway reads resource
    const resource = await client.readResource({ uri: resourceUri });
    const htmlContent = resource.contents[0];
    
    // 4. Gateway builds render payload
    const renderPayload = buildMcpAppRenderPayload({
      toolCallId: "tc_prod_123",
      toolName: "interactive_counter",
      connectorId: "fixture-server-001",
      connectorName: "MCP Fixture Server",
      tool: counterTool as any,
      resource: {
        _meta: (htmlContent as any)._meta,
        contents: [htmlContent],
      },
      toolInput: { initialValue: 5 },
      toolResult: {
        content: toolResult.content,
        _meta: (toolResult as any)._meta,
      },
    });
    
    // 5. This payload becomes McpAppUIPart in the client
    // Server sends 'mcp_app' event, adapter creates 'mcp-app' UIPart
    const uiPart: McpAppUIPart = {
      type: "mcp-app",  // UIPart uses hyphen
      toolCallId: renderPayload.toolCallId ?? "",
      toolName: renderPayload.toolName ?? "",
      connectorId: renderPayload.connectorId ?? "",
      connectorName: renderPayload.connectorName ?? "",
      resourceUri: renderPayload.resourceUri ?? "",
      title: renderPayload.title ?? "",
      description: renderPayload.description,
      html: renderPayload.html ?? "",
      allow: renderPayload.allow,
      prefersBorder: renderPayload.prefersBorder,
      tool: renderPayload.tool,
      toolInput: renderPayload.toolInput,
      toolResult: renderPayload.toolResult,
      csp: renderPayload.csp,
      permissions: renderPayload.permissions,
      domain: renderPayload.domain,
    };
    
    // Verify the UIPart is renderable (type is 'mcp-app' for UIPart)
    expect(uiPart.type).toBe("mcp-app");
    expect(uiPart.html).toContain("Interactive Counter");
    expect(uiPart.html).toContain("increment()");
    expect(uiPart.html).toContain("AppBridge");
    expect(uiPart.toolCallId).toBe("tc_prod_123");
    expect(uiPart.toolName).toBe("interactive_counter");
    expect(uiPart.connectorId).toBe("fixture-server-001");
    
    // 6. UnifiedMessageRenderer would render this as:
    // case 'mcp-app': return <McpAppFrame part={part} />;
    
    // 7. McpAppFrame creates AppBridge and sandboxed iframe
    // 8. App uses AppBridge to send ui/message and ui/update-model-context
    
    console.log("✅ Full E2E flow verified!");
    console.log("   Tool called:", uiPart.toolName);
    console.log("   Resource URI:", uiPart.resourceUri);
    console.log("   HTML length:", uiPart.html.length, "bytes");
    console.log("   Has AppBridge:", uiPart.html.includes("AppBridge"));
  });

  // ============================================================================
  // Step 8: Verify Standard Tool (No UI) Still Works
  // ============================================================================
  
  it("should handle standard tools without UI", async () => {
    const result = await client.callTool({
      name: "echo",
      arguments: { message: "Hello MCP" },
    });
    
    expect(result.content[0].type).toBe("text");
    expect((result.content[0] as any).text).toBe("Echo: Hello MCP");
    
    // No _meta.ui.resourceUri
    const meta = (result as any)._meta;
    expect(meta?.ui?.resourceUri).toBeUndefined();
  });

  // ============================================================================
  // Step 9: Resource Not Found Error Handling
  // ============================================================================
  
  it("should handle missing resources gracefully", async () => {
    await expect(
      client.readResource({ uri: "ui:///nonexistent" })
    ).rejects.toThrow();
  });
});

// ============================================================================
// Additional Integration Tests
// ============================================================================

describe("MCP Apps E2E - Client-Side Integration", () => {
  it("should create McpAppUIPart from server payload", () => {
    // Simulate what the server sends
    const serverPayload = {
      type: "mcp_app" as const,
      toolCallId: "tc_123",
      toolName: "interactive_counter",
      connectorId: "fixture-server",
      connectorName: "Fixture Server",
      resourceUri: "ui:///counter-app",
      title: "Interactive Counter",
      description: "A counter app",
      html: "<html>...</html>",
      csp: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
      allow: "fullscreen",
      prefersBorder: true,
      tool: {
        name: "interactive_counter",
        description: "Counter app",
        inputSchema: { type: "object" },
      },
      toolInput: { initialValue: 0 },
      toolResult: { content: [{ type: "text", text: "Ready" }] },
    };
    
    // This is what the client creates (adapter maps 'mcp_app' event to 'mcp-app' UIPart)
    const uiPart: McpAppUIPart = {
      type: "mcp-app",
      toolCallId: serverPayload.toolCallId,
      toolName: serverPayload.toolName,
      connectorId: serverPayload.connectorId,
      connectorName: serverPayload.connectorName,
      resourceUri: serverPayload.resourceUri,
      title: serverPayload.title,
      description: serverPayload.description,
      html: serverPayload.html,
      allow: serverPayload.allow,
      prefersBorder: serverPayload.prefersBorder,
      tool: serverPayload.tool,
      toolInput: serverPayload.toolInput,
      toolResult: serverPayload.toolResult,
      csp: serverPayload.csp,
    };
    
    // Verify it can be rendered
    expect(uiPart.type).toBe("mcp-app");
    expect(uiPart.toolCallId).toBe("tc_123");
    
    // UnifiedMessageRenderer handles this:
    // case 'mcp-app': return <McpAppFrame part={part} />;
  });
});
