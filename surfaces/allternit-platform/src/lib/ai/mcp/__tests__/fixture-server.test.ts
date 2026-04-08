/**
 * MCP Apps Fixture Server Tests
 * 
 * End-to-end parity verification against published MCP Apps demo servers.
 * These tests verify that the A2rchitect MCP Apps implementation works
 * correctly with real MCP Apps servers.
 * 
 * To run these tests:
 * 1. Start an MCP Apps fixture server (e.g., @modelcontextprotocol/server-puppeteer)
 * 2. Set MCP_FIXTURE_SERVER_URL environment variable
 * 3. Run: pnpm test src/lib/ai/mcp/__tests__/fixture-server.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import { 
  isMcpAppTool, 
  getMcpAppResourceUri, 
  canModelAccessTool, 
  canAppAccessTool,
  getMcpAppToolMeta,
  MCP_APP_RESOURCE_MIME_TYPE,
} from "../apps";
import { requestMcpAppBridge } from "../app-bridge-api";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// Skip tests if no fixture server is configured
const FIXTURE_SERVER_URL = process.env.MCP_FIXTURE_SERVER_URL;
const HAS_FIXTURE = !!FIXTURE_SERVER_URL;

describe.skipIf(!HAS_FIXTURE)("MCP Apps Fixture Server", () => {
  const connectorId = "fixture-test";
  const connectorName = "Fixture Test Server";

  describe("Tool Discovery", () => {
    it("should discover tools with _meta.ui.resourceUri", async () => {
      const tools = await requestMcpAppBridge<{ tools: Tool[] }>({
        action: "tools/list",
        connectorId,
      });

      expect(tools.tools).toBeDefined();
      expect(tools.tools.length).toBeGreaterThan(0);

      // Find tools with UI resources
      const uiTools = tools.tools.filter(isMcpAppTool);
      expect(uiTools.length).toBeGreaterThan(0);
    });

    it("should preserve tool metadata including _meta.ui", async () => {
      const tools = await requestMcpAppBridge<{ tools: Tool[] }>({
        action: "tools/list",
        connectorId,
      });

      for (const tool of tools.tools) {
        const meta = getMcpAppToolMeta(tool);
        
        if (meta?.resourceUri) {
          // Verify resourceUri starts with ui://
          expect(meta.resourceUri).toMatch(/^ui:\/\//);
          
          // Verify visibility is valid
          expect(meta.visibility).toBeDefined();
          expect(meta.visibility?.length).toBeGreaterThan(0);
        }
      }
    });

    it("should enforce tool visibility (model vs app)", async () => {
      const tools = await requestMcpAppBridge<{ tools: Tool[] }>({
        action: "tools/list",
        connectorId,
      });

      for (const tool of tools.tools) {
        const meta = getMcpAppToolMeta(tool);
        
        if (meta?.visibility) {
          // Verify each visibility value is valid
          for (const v of meta.visibility) {
            expect(["model", "app"]).toContain(v);
          }
          
          // Check access based on visibility
          const canModel = canModelAccessTool(tool);
          const canApp = canAppAccessTool(tool);
          
          expect(canModel).toBe(meta.visibility.includes("model"));
          expect(canApp).toBe(meta.visibility.includes("app"));
        }
      }
    });
  });

  describe("Resource Reading", () => {
    it("should read ui:// resources from the owning server", async () => {
      // First, get tools and find one with a UI resource
      const tools = await requestMcpAppBridge<{ tools: Tool[] }>({
        action: "tools/list",
        connectorId,
      });

      const uiTool = tools.tools.find(isMcpAppTool);
      expect(uiTool).toBeDefined();

      if (!uiTool) return;

      const resourceUri = getMcpAppResourceUri(uiTool);
      expect(resourceUri).toBeDefined();

      if (!resourceUri) return;

      // Read the resource
      const resource = await requestMcpAppBridge({
        action: "resources/read",
        connectorId,
        params: { uri: resourceUri },
      });

      expect(resource).toBeDefined();
      expect(resource.contents).toBeDefined();
      expect(resource.contents.length).toBeGreaterThan(0);

      // Verify the content includes MCP App HTML
      const htmlContent = resource.contents.find(
        (c: { mimeType?: string; text?: string }) => 
          c.mimeType === MCP_APP_RESOURCE_MIME_TYPE || 
          c.mimeType === "text/html"
      );

      expect(htmlContent).toBeDefined();
      expect(htmlContent.text).toContain("<");
    });

    it("should reject cross-server resource reads", async () => {
      // This test verifies that resources from one server cannot be
      // accessed through another server's connection
      
      // Attempt to read a resource with a different connector ID
      // This should fail because the resource doesn't belong to that server
      await expect(
        requestMcpAppBridge({
          action: "resources/read",
          connectorId: "wrong-connector",
          params: { uri: "ui:///test" },
        })
      ).rejects.toThrow();
    });
  });

  describe("App-Originated Tool Calls", () => {
    it("should allow app to call model-visible tools", async () => {
      const tools = await requestMcpAppBridge<{ tools: Tool[] }>({
        action: "tools/list",
        connectorId,
      });

      // Find a tool that's visible to the model
      const modelVisibleTool = tools.tools.find((t) => canModelAccessTool(t));
      
      if (!modelVisibleTool) {
        console.warn("No model-visible tools found, skipping test");
        return;
      }

      // Call the tool
      const result = await requestMcpAppBridge({
        action: "tools/call",
        connectorId,
        params: {
          name: modelVisibleTool.name,
          arguments: {},
        },
      });

      expect(result).toBeDefined();
    });

    it("should allow app to call app-only tools", async () => {
      const tools = await requestMcpAppBridge<{ tools: Tool[] }>({
        action: "tools/list",
        connectorId,
      });

      // Find a tool that's only visible to the app
      const appOnlyTool = tools.tools.find(
        (t) => !canModelAccessTool(t) && canAppAccessTool(t)
      );

      if (!appOnlyTool) {
        console.warn("No app-only tools found, skipping test");
        return;
      }

      // Call the tool
      const result = await requestMcpAppBridge({
        action: "tools/call",
        connectorId,
        params: {
          name: appOnlyTool.name,
          arguments: {},
        },
      });

      expect(result).toBeDefined();
    });
  });

  describe("Full Integration Flow", () => {
    it("should complete the full MCP Apps lifecycle", async () => {
      // 1. Discover tools
      const tools = await requestMcpAppBridge<{ tools: Tool[] }>({
        action: "tools/list",
        connectorId,
      });

      expect(tools.tools.length).toBeGreaterThan(0);

      // 2. Find a UI-backed tool
      const uiTool = tools.tools.find(isMcpAppTool);
      expect(uiTool).toBeDefined();

      if (!uiTool) return;

      // 3. Get the UI resource
      const resourceUri = getMcpAppResourceUri(uiTool);
      expect(resourceUri).toBeDefined();

      if (!resourceUri) return;

      // 4. Read the resource
      const resource = await requestMcpAppBridge({
        action: "resources/read",
        connectorId,
        params: { uri: resourceUri },
      });

      expect(resource.contents).toBeDefined();

      // 5. Verify the resource has proper metadata
      const meta = resource._meta;
      if (meta?.["io.modelcontextprotocol/ui"]) {
        const uiMeta = meta["io.modelcontextprotocol/ui"];
        expect(uiMeta.csp || uiMeta.permissions).toBeDefined();
      }
    });
  });
});

describe("MCP Apps Parity Checklist", () => {
  it("has all required types and functions", () => {
    // Verify all required exports exist
    expect(typeof isMcpAppTool).toBe("function");
    expect(typeof getMcpAppResourceUri).toBe("function");
    expect(typeof canModelAccessTool).toBe("function");
    expect(typeof canAppAccessTool).toBe("function");
    expect(typeof getMcpAppToolMeta).toBe("function");
    expect(typeof requestMcpAppBridge).toBe("function");
    expect(typeof MCP_APP_RESOURCE_MIME_TYPE).toBe("string");
  });

  it("validates ui:// URI format", () => {
    const validTool: Tool = {
      name: "test",
      _meta: {
        ui: {
          resourceUri: "ui:///test-app",
        },
      },
    };

    expect(getMcpAppResourceUri(validTool)).toBe("ui:///test-app");

    const invalidTool: Tool = {
      name: "test",
      _meta: {
        ui: {
          resourceUri: "https://example.com",
        },
      },
    };

    expect(() => getMcpAppResourceUri(invalidTool)).toThrow();
  });
});
