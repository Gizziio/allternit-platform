/**
 * MCP component types
 */

export interface McpServer {
  name: string
  config: unknown
  status: 'connected' | 'disconnected'
}

export interface McpTool {
  name: string
  description: string
  inputSchema: unknown
}

// Server info types
export interface StdioServerInfo {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  status: 'connected' | 'disconnected'
  type?: 'stdio'
  config?: Record<string, unknown>
  scope?: 'user' | 'local' | 'project' | 'dynamic' | 'enterprise' | 'claudeai' | 'managed'
  client?: {
    type: string
    [key: string]: unknown
  }
  transport?: string
}

export interface HTTPServerInfo {
  name: string
  url: string
  status: 'connected' | 'disconnected'
  type?: 'http'
  config?: Record<string, unknown>
  scope?: 'user' | 'local' | 'project' | 'dynamic' | 'enterprise' | 'claudeai' | 'managed'
  isAuthenticated?: boolean
  client?: { type: string; [key: string]: unknown }
  transport?: string
}

export interface SSEServerInfo {
  name: string
  url: string
  status: 'connected' | 'disconnected'
  type?: 'sse'
  config?: Record<string, unknown>
  scope?: 'user' | 'local' | 'project' | 'dynamic' | 'enterprise' | 'claudeai' | 'managed'
  isAuthenticated?: boolean
  client?: { type: string; [key: string]: unknown }
  transport?: string
}

export interface ClaudeAIServerInfo {
  name: string
  type: 'claude-ai'
  status: 'connected' | 'disconnected'
  config?: Record<string, unknown>
  scope?: 'user' | 'local' | 'project' | 'dynamic' | 'enterprise' | 'claudeai' | 'managed'
  isAuthenticated?: boolean
  client?: { type: string; [key: string]: unknown }
  transport?: string
}

export type ServerInfo = StdioServerInfo | HTTPServerInfo | SSEServerInfo | ClaudeAIServerInfo

// Additional types
export interface McpServerStatus {
  name: string
  status: 'connected' | 'disconnected' | 'error' | 'pending' | 'needs-auth' | 'disabled' | 'failed'
  error?: string
  tools?: McpTool[]
  client?: unknown
  serverInfo?: {
    name: string
    version: string
  }
  capabilities?: Record<string, unknown>
  scope?: 'user' | 'local' | 'project' | 'dynamic' | 'enterprise' | 'claudeai' | 'managed'
  config?: unknown
}

// Agent MCP server info
export interface AgentMcpServerInfo {
  name: string
  description?: string
  tools?: unknown[]
}

// MCP View state
export interface MCPViewState {
  selectedServer: string | null
  viewMode: 'list' | 'detail' | 'settings'
}
