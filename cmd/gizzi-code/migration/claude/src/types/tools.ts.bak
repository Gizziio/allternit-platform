/**
 * Tool types
 * TEMPORARY SHIM - Replace with proper Allternit SDK types
 */

// ============================================================================
// Base Tool Types
// ============================================================================

export interface Tool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
  // Additional properties for tool handling
  userFacingName?: (input?: unknown) => string
  userFacingNameBackgroundColor?: (input?: unknown) => string | undefined
  isTransparentWrapper?: () => boolean
  inputSchema?: {
    safeParse: (input: unknown) => { success: boolean; data?: unknown }
  }
}

export interface ToolUse {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResult {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<{type: string; text?: string; source?: unknown}>
  is_error?: boolean
}

export interface ToolInputJSONSchema {
  type: 'object'
  properties?: Record<string, unknown>
  required?: string[]
  description?: string
}

// ============================================================================
// Tool Progress Types
// ============================================================================

export interface ToolProgressData {
  toolUseId: string
  toolName: string
  status: 'pending' | 'running' | 'completed' | 'error'
  progress?: number
  message?: string
  output?: string
  type?: string
  command?: string
  exitCode?: number
  // Additional properties for bash tool progress
  fullOutput?: string
  elapsedTimeSeconds?: number
  totalLines?: number
  totalBytes?: number
  timeoutMs?: number
  taskId?: string
}

export interface BashProgress extends ToolProgressData {
  type: 'bash'
  command: string
  exitCode?: number
}

export interface ShellProgress extends ToolProgressData {
  type: 'shell'
  command: string
  exitCode?: number
}

export interface PowerShellProgress extends ToolProgressData {
  type: 'powershell'
  command: string
  exitCode?: number
}

export interface MCPProgress extends ToolProgressData {
  type: 'mcp'
  serverName: string
  operation: string
}

export interface REPLToolProgress extends ToolProgressData {
  type: 'repl'
  language: string
  code: string
}

export interface AgentToolProgress extends ToolProgressData {
  type: 'agent'
  agentName: string
  task: string
}

export interface SkillToolProgress extends ToolProgressData {
  type: 'skill'
  skillName: string
  action: string
}

export interface WebSearchProgress extends ToolProgressData {
  type: 'web_search'
  query: string
  results?: unknown[]
}

export interface TaskOutputProgress extends ToolProgressData {
  type: 'task_output'
  taskId: string
  content: string
}

export interface SdkWorkflowProgress extends ToolProgressData {
  type: 'sdk_workflow'
  workflowName: string
  step?: string
}

// Union type for all progress types
export type ToolProgress = 
  | BashProgress
  | ShellProgress
  | PowerShellProgress
  | MCPProgress
  | REPLToolProgress
  | AgentToolProgress
  | SkillToolProgress
  | WebSearchProgress
  | TaskOutputProgress
  | SdkWorkflowProgress

// ============================================================================
// Legacy Exports
// ============================================================================

export type ToolParam = ToolUse
export type ToolResultBlockParam = ToolResult
