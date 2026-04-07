/**
 * SDK Utility Types
 */

export interface SDKUtilityConfig {
  name: string
  enabled: boolean
}
// Server tool use metrics
export interface ServerToolUseMetrics {
  web_search_requests: number
  web_fetch_requests: number
}

// Cache creation breakdown
export interface CacheCreationMetrics {
  ephemeral_1h_input_tokens: number
  ephemeral_5m_input_tokens: number
}

// Complete usage type with all token fields
export type NonNullableUsage = {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  server_tool_use: ServerToolUseMetrics
  service_tier: string
  cache_creation: CacheCreationMetrics
  inference_geo: string
  iterations: unknown[]
  speed: string
}

export interface SDKUserMessage {
  type: 'user'
  content: string
  id?: string
  timestamp?: number
  session_id?: string
}

// User settings extension
export interface UserSettings {
  version: string
  theme: 'light' | 'dark' | 'system'
  autoCompact: boolean
  compactThreshold: number
  defaultModel: string
  mcpServers: unknown[]
  plugins: string[]
  customKeybindings: Record<string, string>
  userId: string
  preferences: Record<string, unknown>
}
