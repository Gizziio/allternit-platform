/**
 * SDK Tool Types
 */

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: ToolInputSchema
  input_schema?: ToolInputSchema  // Snake case alias
  handler?: string
  type?: string
}

export interface ToolInputSchema {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
  description?: string
}

export interface ToolUseRequest {
  toolUseId: string
  tool_use_id?: string  // Snake case alias
  name: string
  input: Record<string, unknown>
  type?: string
}

export interface ToolUseResult {
  toolUseId: string
  tool_use_id?: string  // Snake case alias
  content: string | unknown[]
  isError?: boolean
  is_error?: boolean  // Snake case alias
  error?: string
  type?: string
}

export interface ToolProgressData {
  toolUseId: string
  tool_use_id?: string  // Snake case alias
  progress: number
  message?: string
  type?: string
  name?: string
  toolName?: string
  status?: 'pending' | 'running' | 'completed' | 'error'
  data?: unknown
}
