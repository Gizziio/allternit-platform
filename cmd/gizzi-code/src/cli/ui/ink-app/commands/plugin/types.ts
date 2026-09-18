/**
 * Plugin Types
 * TEMPORARY SHIM
 */

export interface PluginConfig {
  name: string
  version: string
  enabled: boolean
}

export interface PluginMetadata {
  id: string
  config: PluginConfig
}

export default { }
