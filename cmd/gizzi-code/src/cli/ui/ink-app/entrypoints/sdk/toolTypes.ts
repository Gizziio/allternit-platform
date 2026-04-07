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
  input: Record<string, unknown>
}

export interface ToolUseResult {
  content: string | unknown[]
  isError?: boolean
  is_error?: boolean  // Snake case alias
  error?: string
}

export interface ToolProgressData {
  progress: number
  message?: string
  name?: string
  toolName?: string
  status?: 'pending' | 'running' | 'completed' | 'error'
  data?: unknown
}
