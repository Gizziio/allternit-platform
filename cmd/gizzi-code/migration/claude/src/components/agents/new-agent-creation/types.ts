/**
 * Agent creation wizard types
 */

export interface AgentConfig {
  name: string
  description: string
  color: string
  location: string
  memory?: string
}

export type WizardStep = 'color' | 'description' | 'location' | 'memory' | 'confirm'

export interface CreateAgentState {
  step: WizardStep
  config: Partial<AgentConfig>
}

// Wizard data type for multi-step form
export interface AgentWizardData {
  name: string
  description?: string
  color?: string
  avatar?: string
  systemPrompt?: string
  tools?: string[]
  mcpServers?: string[]
  model?: string
  [key: string]: unknown
}
