/**
 * MCP Types for SDK
 */

export interface McpServerConfigForProcessTransport {
  type?: 'stdio'
  name?: string
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  timeout?: number
}
export interface McpServerConfigForSSETransport {
  name: string
  url: string
  headers?: Record<string, string>
}

export interface McpServerConfigForStdioTransport {
  type?: 'stdio'
  name?: string
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  timeout?: number
}

export type McpServerConfig = 
  | McpServerConfigForProcessTransport
  | McpServerConfigForSSETransport
  | McpServerConfigForStdioTransport
export interface McpServerStatus {
  status: 'connected' | 'disconnected' | 'error' | 'connecting'
  error?: string
  tools?: McpToolInfo[]
  type?: string
  message?: string
  data?: unknown
}

export interface McpToolInfo {
  description: string
  inputSchema: unknown
  input_schema?: unknown  // Snake case alias
}

export interface McpToolResult {
  content: Array<{ type: string; text?: string }>
  isError?: boolean
  is_error?: boolean  // Snake case alias
}

export interface McpClient {
  status?: string
  callTool?: (name: string, args: unknown) => Promise<McpToolResult>
  close?: () => Promise<void>
}
