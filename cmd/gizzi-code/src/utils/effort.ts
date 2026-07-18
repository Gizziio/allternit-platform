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
export { EFFORT_LEVELS, convertEffortValueToLevel, getDefaultEffortForModel, getDisplayedEffortLevel, getEffortEnvOverride, getEffortLevelDescription, getEffortSuffix, getEffortValueDescription, getInitialEffortSetting, getOpusDefaultEffortConfig, isEffortLevel, isValidNumericEffort, modelSupportsEffort, modelSupportsMaxEffort, parseEffortValue, resolveAppliedEffort, resolvePickerEffortPersistence, toPersistableEffort } from "../shared/utils/effort.js";
export type { EffortValue, OpusDefaultEffortConfig } from "../shared/utils/effort.js";
