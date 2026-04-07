/**
 * Config Utilities
 */

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

let globalConfig: GlobalConfig = {}

export function getGlobalConfig(): GlobalConfig {
  return globalConfig
}

export function setGlobalConfig(config: GlobalConfig): void {
  globalConfig = { ...globalConfig, ...config }
}
