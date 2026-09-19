/**
 * New Agent Creation Types
 * TEMPORARY SHIM
 */

export interface AgentCreationStep {
  id: string
  name: string
  completed: boolean
}

export interface AgentCreationState {
  steps: AgentCreationStep[]
  currentStep: number
}

// Wizard data carried through the create-agent wizard steps. Field shapes
// recovered from the pre-compilation sources of the wizard step components
// (artifact sourcemaps) — the original definition was lost with the
// TEMPORARY SHIM above.
export type AgentWizardData = {
  location?: import('../../../utils/settings/constants.js').SettingSource
  method?: 'generate' | 'manual'
  wasGenerated?: boolean
  isGenerating?: boolean
  generationPrompt?: string
  agentType?: string
  systemPrompt?: string
  whenToUse?: string
  selectedModel?: string
  selectedTools?: string[] | undefined
  selectedColor?: string | undefined
  selectedMemory?: import('../../../tools/AgentTool/agentMemory.js').AgentMemoryScope | undefined
  generatedAgent?:
    | { identifier: string; whenToUse: string; systemPrompt: string }
    | undefined
  finalAgent?:
    | (Omit<import('../../../tools/AgentTool/loadAgentsDir.js').CustomAgentDefinition, 'location'> & {
        memory?: import('../../../tools/AgentTool/agentMemory.js').AgentMemoryScope
      })
    | undefined
}

export default { }
