/**
 * Config Utilities
 */

import { saveGlobalConfig as saveRealGlobalConfig } from '../shared/utils/config.js'

export type { PastedContent } from '../shared/utils/config.js'

export interface Config {
  [key: string]: unknown
}

export function getConfig(): Config {
  return {}
}

export function setConfig(key: string, value: unknown): void {
  // Implementation
}

// Global config for buddy/companion
export interface GlobalConfig {
  theme?: string
  notifications?: boolean
  autoUpdate?: boolean
  telemetry?: boolean
  debug?: boolean
  [key: string]: unknown
}

// Delegates to the real config store; the merge-by-re-export below provides
// the canonical getGlobalConfig/saveGlobalConfig from the complete counterpart.
export function setGlobalConfig(config: GlobalConfig): void {
  saveRealGlobalConfig((current: GlobalConfig) => ({ ...current, ...config }))
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export * from '../shared/utils/config.js'
