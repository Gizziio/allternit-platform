import type { McpServer } from "@agentclientprotocol/sdk"
import type { AllternitClient } from "@allternit/sdk"

export interface ACPSessionState {
  id: string
  cwd: string
  mcpServers: McpServer[]
  createdAt: Date
  model?: {
    providerID: string
    modelID: string
  }
  variant?: string
  modeId?: string
}

// Use the real AllternitClient type
export type AllternitClientLike = AllternitClient

export interface ACPConfig {
  sdk: AllternitClientLike
  defaultModel?: {
    providerID: string
    modelID: string
  }
}
