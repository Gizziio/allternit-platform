/**
 * Settings Types
 */

export interface Settings {
  theme?: string
  autoCompact?: boolean
  [key: string]: unknown
}

export interface PluginHookMatcher {
  plugin: string
  hook: string
}

export interface HooksSettings {
  [hook: string]: unknown
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export * from '../../shared/utils/settings/types.js'
