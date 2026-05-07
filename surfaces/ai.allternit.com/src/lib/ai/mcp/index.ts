// MCP Apps - Model Context Protocol support for allternit

// Core MCP Apps types and utilities
export {
  MCP_APPS_EXTENSION_ID,
  MCP_APP_RESOURCE_MIME_TYPE,
  MCP_APP_RESOURCE_URI_META_KEY,
  MCP_APPS_CLIENT_CAPABILITIES,
  getMcpAppToolMeta,
  getMcpAppResourceUri,
  isMcpAppTool,
  canModelAccessTool,
  canAppAccessTool,
  getMcpAppCapability,
  clientSupportsMcpApps,
  buildMcpAppAllowAttribute,
  getMcpAppResourceMeta,
  getMcpAppHtmlResourceContent,
  buildMcpAppRenderPayload,
  coerceMcpAppToolResult,
} from "./apps";

export type {
  McpAppToolVisibility,
  McpAppBridgeDisplayMode,
  McpAppBridgeAction,
  McpAppToolMeta,
  McpAppToolDefinition,
  McpAppResourcePermissions,
  McpAppResourceCsp,
  McpAppResourceMeta,
  McpAppTextResourceContent,
  McpAppResourceResultLike,
  McpAppBridgeRequest,
  McpAppRenderEventPayload,
  McpAppClientCapabilities,
} from "./apps";

// MCP Client wrapper
export {
  MCPClient,
  getOrCreateMcpClient,
  removeMcpClient,
  createMcpClientForCallback,
} from "./mcp-client";

// MCP App Bridge API
export { requestMcpAppBridge } from "./app-bridge-api";

// MCP App Context Provider (for ui/message and ui/update-model-context)
export {
  McpAppHostProvider,
  useMcpAppHost,
  useMcpAppMessenger,
  useMcpAppModelContext,
  useMcpAppMessageSubscription,
} from "./app-context";

export type {
  McpAppModelContext,
  McpAppMessage,
} from "./app-context";

// Cache utilities
export {
  invalidateAllMcpCaches,
} from "./cache";

export type {
  ConnectionStatusResult,
  DiscoveryResult,
} from "./cache";

// Sandbox proxy client
export {
  createSandbox,
  isSandboxAvailable,
  logCspViolation,
  logBlockedAction,
} from "./sandbox-client";

export type {
  SandboxConfig,
  SandboxInstance,
} from "./sandbox-client";
