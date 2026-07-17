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
export * from '../shared/utils/advisor.js'
