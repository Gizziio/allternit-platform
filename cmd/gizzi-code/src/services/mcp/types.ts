/**
 * MCP Service Types
 * Type definitions for Model Context Protocol server management
 */

import type { z } from 'zod/v4'

export interface MCPServerConfig {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  disabled?: boolean
  timeout?: number
  retryCount?: number
}

export interface MCPToolDefinition {
  name: string
  description?: string
  inputSchema?: z.ZodType<unknown>
  handler: (params: unknown) => Promise<unknown>
}

export interface MCPResourceDefinition {
  uri: string
  name?: string
  description?: string
  mimeType?: string
  handler: () => Promise<unknown>
}

export interface MCPServerStatus {
  name: string
  status: 'running' | 'stopped' | 'error' | 'connecting' | 'restarting'
  pid?: number
  error?: string
  uptime?: number
  tools: MCPToolDefinition[]
  resources: MCPResourceDefinition[]
  lastStarted?: Date
  lastStopped?: Date
  restartCount: number
}

export interface MCPTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface MCPResource {
  uri: string
  name?: string
  description?: string
  mimeType?: string
}

export interface MCPConnection {
  server: MCPServerConfig
  status: MCPServerStatus
  transport: 'stdio' | 'http' | 'sse'
}

export type MCPEvent =
  | { type: 'server_started'; server: string }
  | { type: 'server_stopped'; server: string }
  | { type: 'server_error'; server: string; error: string }
  | { type: 'tools_changed'; server: string }
  | { type: 'server_restarting'; server: string; attempt: number }
  | { type: 'tool_called'; server: string; tool: string; duration: number }
  | { type: 'resource_read'; server: string; resource: string }

export interface MCPRegistryState {
  servers: MCPServerConfig[]
  status: Record<string, MCPServerStatus>
}
