// Server-only MCP exports — these must never be imported by client components.
// They rely on Node.js-only modules (@ai-sdk/mcp, sqlite, etc.).

export {
  MCPClient,
  getOrCreateMcpClient,
  removeMcpClient,
  createMcpClientForCallback,
} from "./mcp-client";
