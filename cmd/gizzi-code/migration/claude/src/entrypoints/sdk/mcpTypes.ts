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
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
}

export type McpServerConfig = 
  | McpServerConfigForProcessTransport
  | McpServerConfigForSSETransport
  | McpServerConfigForStdioTransport

export interface McpServerStatus {
  name: string
  status: 'connected' | 'disconnected' | 'error' | 'connecting'
  error?: string
  tools?: McpToolInfo[]
  type?: string
  message?: string
  data?: unknown
}

export interface McpToolInfo {
  name: string
  description: string
  inputSchema: unknown
  input_schema?: unknown  // Snake case alias
}

export interface McpToolResult {
  content: Array<{ type: string; text?: string }>
  isError?: boolean
  is_error?: boolean  // Snake case alias
  error?: string
  data?: unknown
}

export interface McpClient {
  name: string
  type?: string
  status?: string
  tools?: McpToolInfo[]
  callTool?: (name: string, args: unknown) => Promise<McpToolResult>
  close?: () => Promise<void>
}
