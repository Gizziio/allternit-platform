import type { McpServer } from "@agentclientprotocol/sdk"
import type { A2RClient } from "@a2r/sdk/v2"

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

export interface ACPConfig {
  sdk: A2RClient
  defaultModel?: {
    providerID: string
    modelID: string
  }
}
