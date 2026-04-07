/**
 * Allternit API Resources
 * TEMPORARY SHIM
 */

export interface Message {
  id: string
  type: 'message'
  role: 'user' | 'assistant'
  content: Array<{
    type: 'text' | 'tool_use' | 'tool_result' | 'thinking'
    text?: string
    thinking?: string
    signature?: string
    id?: string
    name?: string
    input?: unknown
  }>
  model?: string
  stop_reason?: string | null
  usage?: {
    input_tokens: number
    output_tokens: number
  }
}

export interface ContentBlockParam {
  type: 'text' | 'image' | 'tool_use' | 'tool_result' | 'document'
  text?: string
  source?: {
    type: 'base64' | 'url'
    media_type: string
    data: string
  }
  id?: string
  name?: string
  input?: unknown
  content?: string | unknown[]
  is_error?: boolean
}

export interface TextBlockParam {
  type: 'text'
  text: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolUseBlockParam {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultBlockParam {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<{type: string; text?: string}>
  is_error?: boolean
}

export interface ImageBlockParam {
  type: 'image'
  source: {
    type: 'base64' | 'url'
    media_type: string
    data: string
  }
}

export interface DocumentBlockParam {
  type: 'document'
  source: {
    type: 'base64' | 'url'
    media_type: string
    data: string
  }
}

export interface ThinkingBlockParam {
  type: 'thinking'
  thinking: string
  signature: string
}

export interface MessageParam {
  role: 'user' | 'assistant'
  content: string | ContentBlockParam[]
}

export interface Base64ImageSource {
  type: 'base64'
  media_type: string
  data: string
}

// @ts-ignore Types used as values
const AllternitAPIResources = {
  // These are type-only exports and cannot be used as runtime values
  Message: undefined as any,
  ContentBlockParam: undefined as any,
  MessageParam: undefined as any,
  Base64ImageSource: undefined as any,
}
export default AllternitAPIResources
