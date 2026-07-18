/**
 * Advisor Utilities
 */

export interface AdvisorSuggestion {
  type: string
  message: string
}

export function getAdvisorSuggestions(): AdvisorSuggestion[] {
  return []
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export { ADVISOR_TOOL_INSTRUCTIONS, canUserConfigureAdvisor, getAdvisorUsage, getExperimentAdvisorModels, getInitialAdvisorSetting, isAdvisorBlock, isAdvisorEnabled, isValidAdvisorModel, modelSupportsAdvisor } from "../shared/utils/advisor.js";
export type { AdvisorBlock, AdvisorServerToolUseBlock, AdvisorToolResultBlock } from "../shared/utils/advisor.js";
