import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  MCP_APP_RESOURCE_MIME_TYPE,
  MCP_APPS_CLIENT_CAPABILITIES,
  MCP_APPS_EXTENSION_ID,
  buildMcpAppRenderPayload,
  buildMcpAppAllowAttribute,
  canAppAccessTool,
  canModelAccessTool,
  clientSupportsMcpApps,
  coerceMcpAppToolResult,
  getMcpAppCapability,
  getMcpAppHtmlResourceContent,
  getMcpAppResourceMeta,
  getMcpAppResourceUri,
  getMcpAppToolMeta,
  isMcpAppTool,
} from "./apps";

describe("MCP Apps helpers", () => {
  it("extracts nested ui.resourceUri and applies default visibility", () => {
    const tool = {
      _meta: {
        ui: {
          resourceUri: "ui://weather/dashboard",
        },
      },
    };

    assert.deepEqual(getMcpAppToolMeta(tool), {
      resourceUri: "ui://weather/dashboard",
      visibility: ["model", "app"],
    });
    assert.equal(getMcpAppResourceUri(tool), "ui://weather/dashboard");
    assert.equal(isMcpAppTool(tool), true);
  });

  it("prefers nested ui.resourceUri over deprecated flat metadata", () => {
    const tool = {
      _meta: {
        ui: {
          resourceUri: "ui://nested/app",
          visibility: ["app"],
        },
        "ui/resourceUri": "ui://legacy/app",
      },
    };

    assert.deepEqual(getMcpAppToolMeta(tool), {
      resourceUri: "ui://nested/app",
      visibility: ["app"],
    });
  });

  it("supports deprecated flat ui/resourceUri metadata", () => {
    const tool = {
      _meta: {
        "ui/resourceUri": "ui://legacy/dashboard",
      },
    };

    assert.equal(getMcpAppResourceUri(tool), "ui://legacy/dashboard");
    assert.equal(canModelAccessTool(tool), true);
    assert.equal(canAppAccessTool(tool), true);
  });

  it("rejects invalid non-ui resource URIs", () => {
    assert.throws(
      () =>
        getMcpAppToolMeta({
          _meta: {
            ui: {
              resourceUri: "https://example.com/not-allowed",
            },
          },
        }),
      /Invalid MCP App resource URI/,
    );
  });

  it("treats standard non-app tools as accessible to both model and app", () => {
    const tool = {
      name: "plain_tool",
    };

    assert.equal(canModelAccessTool(tool), true);
    assert.equal(canAppAccessTool(tool), true);
    assert.equal(isMcpAppTool(tool), false);
  });

  it("respects explicit app-only visibility", () => {
    const tool = {
      _meta: {
        ui: {
          resourceUri: "ui://dashboard/interactive",
          visibility: ["app"],
        },
      },
    };

    assert.equal(canModelAccessTool(tool), false);
    assert.equal(canAppAccessTool(tool), true);
  });

  it("extracts MCP Apps extension capabilities", () => {
    const capabilities = {
      extensions: {
        [MCP_APPS_EXTENSION_ID]: {
          mimeTypes: [MCP_APP_RESOURCE_MIME_TYPE, "text/plain"],
        },
      },
    };

    assert.deepEqual(getMcpAppCapability(capabilities), {
      mimeTypes: [MCP_APP_RESOURCE_MIME_TYPE, "text/plain"],
    });
    assert.equal(clientSupportsMcpApps(capabilities), true);
  });

  it("advertises MCP Apps support in the default client capabilities", () => {
    assert.deepEqual(getMcpAppCapability(MCP_APPS_CLIENT_CAPABILITIES), {
      mimeTypes: [MCP_APP_RESOURCE_MIME_TYPE],
    });
    assert.equal(clientSupportsMcpApps(MCP_APPS_CLIENT_CAPABILITIES), true);
  });

  it("returns false when the client does not advertise the MCP Apps mime type", () => {
    const capabilities = {
      extensions: {
        [MCP_APPS_EXTENSION_ID]: {
          mimeTypes: ["text/plain"],
        },
      },
    };

    assert.equal(clientSupportsMcpApps(capabilities), false);
  });

  it("builds iframe allow attributes from spec permissions", () => {
    assert.equal(
      buildMcpAppAllowAttribute({
        microphone: {},
        clipboardWrite: {},
        geolocation: {},
      }),
      "microphone; geolocation; clipboard-write",
    );
  });

  it("extracts html resource contents and extension metadata", () => {
    const resource = {
      _meta: {
        [MCP_APPS_EXTENSION_ID]: {
          domain: "https://apps.example.com",
          prefersBorder: false,
          permissions: {
            camera: {},
            clipboardWrite: {},
          },
          csp: {
            connect_domains: ["https://api.example.com"],
            resource_domains: ["https://cdn.example.com"],
          },
        },
      },
      contents: [
        {
          uri: "ui://weather/dashboard",
          mimeType: MCP_APP_RESOURCE_MIME_TYPE,
          text: "<!doctype html><html><body>app</body></html>",
          title: "Weather Dashboard",
        },
      ],
    };

    assert.deepEqual(getMcpAppHtmlResourceContent(resource), {
      uri: "ui://weather/dashboard",
      mimeType: MCP_APP_RESOURCE_MIME_TYPE,
      name: undefined,
      title: "Weather Dashboard",
      text: "<!doctype html><html><body>app</body></html>",
    });
    assert.deepEqual(getMcpAppResourceMeta(resource), {
      csp: {
        connectDomains: ["https://api.example.com"],
        resourceDomains: ["https://cdn.example.com"],
        frameDomains: undefined,
        baseUriDomains: undefined,
      },
      permissions: {
        camera: {},
        microphone: undefined,
        geolocation: undefined,
        clipboardWrite: {},
      },
      domain: "https://apps.example.com",
      prefersBorder: false,
    });
  });

  it("builds a render payload when an app tool result includes html", () => {
    const tool = {
      name: "weather.dashboard",
      title: "Weather Dashboard",
      description: "Live weather",
      inputSchema: {
        type: "object",
        properties: {
          location: {
            type: "string",
          },
        },
      },
      _meta: {
        ui: {
          resourceUri: "ui://weather/dashboard",
        },
      },
    };
    const resource = {
      _meta: {
        [MCP_APPS_EXTENSION_ID]: {
          permissions: {
            geolocation: {},
          },
        },
      },
      contents: [
        {
          uri: "ui://weather/dashboard",
          mimeType: MCP_APP_RESOURCE_MIME_TYPE,
          text: "<html>ok</html>",
        },
      ],
    };

    assert.deepEqual(
      buildMcpAppRenderPayload({
        toolCallId: "tool-123",
        toolName: "weather.dashboard",
        connectorId: "connector-1",
        connectorName: "Weather",
        tool,
        resource,
        toolInput: {
          location: "Austin",
        },
        toolResult: {
          content: [
            {
              type: "text",
              text: "Sunny",
            },
          ],
        },
      }),
      {
        toolCallId: "tool-123",
        toolName: "weather.dashboard",
        connectorId: "connector-1",
        connectorName: "Weather",
        title: "Weather Dashboard",
        description: "Live weather",
        resourceUri: "ui://weather/dashboard",
        html: "<html>ok</html>",
        allow: "geolocation",
        prefersBorder: true,
        tool: {
          name: "weather.dashboard",
          title: "Weather Dashboard",
          description: "Live weather",
          inputSchema: {
            type: "object",
            properties: {
              location: {
                type: "string",
              },
            },
          },
          annotations: undefined,
          _meta: {
            ui: {
              resourceUri: "ui://weather/dashboard",
            },
          },
        },
        toolInput: {
          location: "Austin",
        },
        toolResult: {
          content: [
            {
              type: "text",
              text: "Sunny",
            },
          ],
        },
        csp: undefined,
        permissions: {
          camera: undefined,
          microphone: undefined,
          geolocation: {},
          clipboardWrite: undefined,
        },
        domain: undefined,
      },
    );
  });

  it("coerces structured tool payloads into MCP CallToolResult shape", () => {
    assert.deepEqual(
      coerceMcpAppToolResult({
        answer: 42,
      }),
      {
        content: [
          {
            type: "text",
            text: '{\n  "answer": 42\n}',
          },
        ],
        structuredContent: {
          answer: 42,
        },
      },
    );
  });

  it("passes through already-structured MCP CallToolResult payloads", () => {
    const result = {
      content: [
        {
          type: "text",
          text: "ready",
        },
      ],
      structuredContent: {
        status: "ready",
      },
    };

    assert.deepEqual(coerceMcpAppToolResult(result), result);
  });
});
