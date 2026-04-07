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

export default { }
