/**
 * Generated Core Types
 * Auto-generated from core schemas
 */

export interface GeneratedCoreTypes {
  version: string
  types: unknown[]
}

export interface SDKRateLimitInfo {
  limit: number
  remaining: number
  resetAt: number
}

export type ApiKeySource = 'env' | 'config' | 'keychain' | 'prompt'

// Hook input types
export interface PermissionDeniedHookInput {
  toolName: string
  toolUseId: string
  reason: string
}

export interface PreCompactHookInput {
  messageCount: number
  direction: 'up' | 'down' | 'both'
}

export interface PostCompactHookInput {
  boundaryMarker: string
  summaryMessages: unknown[]
}

export interface SessionStartHookInput {
  sessionId: string
  timestamp: number
}

export interface SessionEndHookInput {
  sessionId: string
  duration: number
  messageCount: number
}

export interface ConfigChangeHookInput {
  key: string
  oldValue: unknown
  newValue: unknown
}

export interface CwdChangedHookInput {
  oldCwd: string
  newCwd: string
}

export interface FileChangedHookInput {
  path: string
  changeType: 'create' | 'modify' | 'delete'
}

export interface InstructionsLoadedHookInput {
  instructions: string
  source: string
}

export interface PermissionRequestHookInput {
  toolName: string
  toolUseId: string
  input: Record<string, unknown>
}

export interface ElicitationHookInput {
  prompt: string
  context?: Record<string, unknown>
}

export interface ElicitationResultHookInput {
  result: string
  prompt: string
}
