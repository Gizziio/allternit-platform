/**
 * Effort Level Utilities
 */

export type { EffortValue } from '../shared/utils/effort.js'

export type EffortLevel = 'low' | 'medium' | 'high' | 'max'

export function getEffortLevel(): EffortLevel {
  return 'medium'
}

export function setEffortLevel(level: EffortLevel): void {
  // Implementation
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export * from '../shared/utils/effort.js'
