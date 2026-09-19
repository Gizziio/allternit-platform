/**
 * MCP component types
 */

import type { ConfigScope, MCPServerConnection } from '../../services/mcp/types'

export interface McpServer {
  name: string
  config: unknown
  status: 'connected' | 'disconnected'
}

export interface McpTool {
  description: string
  inputSchema: unknown
}

// Server info types — shape recovered from the decompiled consumers and the
// runtime producer (services/mcp/utils.ts extractAgentMcpServers / the
// prepareServers mapping in MCPSettings); the previous shim predated the
// codemod and did not match either side.
interface ServerInfoBase {
  name: string
  client: MCPServerConnection
  scope: ConfigScope
}

export interface StdioServerInfo extends ServerInfoBase {
  transport: 'stdio'
  isAuthenticated?: boolean
  command?: string
  args?: string[]
  env?: Record<string, string>
  config?: unknown
}

export interface HTTPServerInfo extends ServerInfoBase {
  transport: 'http'
  isAuthenticated?: boolean
  url?: string
  config?: unknown
}

export interface SSEServerInfo extends ServerInfoBase {
  transport: 'sse'
  isAuthenticated?: boolean
  url?: string
  config?: unknown
}

export interface ClaudeAIServerInfo extends ServerInfoBase {
  transport: 'claudeai-proxy'
  isAuthenticated?: boolean
  config?: unknown
}

export type ServerInfo = StdioServerInfo | HTTPServerInfo | SSEServerInfo | ClaudeAIServerInfo

// Additional types
export interface McpServerStatus {
  status: 'connected' | 'disconnected' | 'error' | 'pending' | 'needs-auth' | 'disabled' | 'failed'
  error?: string
  tools?: McpTool[]
  client?: unknown
  serverInfo?: {
    name: string
    version: string
  }
  capabilities?: Record<string, unknown>
  config?: unknown
}

// Agent MCP server info — fields recovered from the runtime producer
// (services/mcp/utils.ts extractAgentMcpServers).
export interface AgentMcpServerInfo {
  name: string
  sourceAgents: string[]
  transport: string
  command?: string
  url?: string
  needsAuth: boolean
  isAuthenticated?: boolean
  description?: string
  tools?: unknown[]
}

// MCP view state — discriminated union recovered from the decompiled
// consumers (MCPSettings switch and its setViewState call sites).
export type MCPViewState =
  | { type: 'list'; defaultTab?: string }
  | { type: 'server-menu'; server: ServerInfo }
  | { type: 'agent-server-menu'; agentServer: AgentMcpServerInfo }
  | { type: 'server-tools'; server: ServerInfo }
  | { type: 'server-tool-detail'; server: ServerInfo; toolIndex: number }
