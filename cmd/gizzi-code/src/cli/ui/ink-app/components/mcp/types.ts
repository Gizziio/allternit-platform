/**
 * MCP component types
 */

export interface McpServer {
  name: string
  config: unknown
  status: 'connected' | 'disconnected'
}

export interface McpTool {
  description: string
  inputSchema: unknown
}

// Server info types
export interface StdioServerInfo {
  command: string
  args: string[]
  env?: Record<string, string>
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
  url: string
  type?: 'http'
  isAuthenticated?: boolean
  client?: { type: string; [key: string]: unknown }
}

export interface SSEServerInfo {
  type?: 'sse'
}

export interface ClaudeAIServerInfo {
  type: 'claude-ai'
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

// Agent MCP server info
export interface AgentMcpServerInfo {
  description?: string
  tools?: unknown[]
}

// MCP View state
export interface MCPViewState {
  selectedServer: string | null
  viewMode: 'list' | 'detail' | 'settings'
}
