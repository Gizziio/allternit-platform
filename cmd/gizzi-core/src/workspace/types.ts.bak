/**
 * GIZZI Workspace Types
 * 
 * Type definitions for the .gizzi/ workspace system.
 */

export interface WorkspaceIdentity {
  name: string
  emoji: string
  vibe: string
  description?: string
}

export interface WorkspaceSoul {
  coreTruths: string[]
  behavioralGuidelines: string[]
  continuityNotes: string
}

export interface WorkspaceUser {
  role?: string
  preferences: string[]
  context?: string
}

export interface WorkspaceMemory {
  longTerm: MemoryEntry[]
  sessionNotes: string[]
}

export interface MemoryEntry {
  id: string
  timestamp: number
  content: string
  tags: string[]
}

export interface WorkspaceConfig {
  identity: WorkspaceIdentity
  soul: WorkspaceSoul
  user: WorkspaceUser
  memory: WorkspaceMemory
}

// Layered configuration levels
export type ConfigLayer = 
  | "L1_Organization"  // .well-known/gizzi config
  | "L2_User"          // ~/.gizzi/config.json
  | "L3_Project"       // ./.gizzi/config.json
  | "L4_Session"       // Session-specific overrides
  | "L5_Inline"        // Command-line flags

export interface LayeredConfig {
  layer: ConfigLayer
  source: string
  config: unknown
  precedence: number
}
