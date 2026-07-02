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
