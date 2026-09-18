/**
 * Generated Settings Types
 * Auto-generated from settings schemas
 */

export interface Settings {
  version: string
  theme: 'light' | 'dark' | 'system'
  autoCompact: boolean
  compactThreshold: number
  defaultModel: string
  mcpServers: unknown[]
  plugins: string[]
  customKeybindings: Record<string, string>
}

export interface UserSettings extends Settings {
  userId: string
  preferences: Record<string, unknown>
}
