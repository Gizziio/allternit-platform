/**
 * Plugin command types
 * TEMPORARY SHIM
 */

export interface PluginConfig {
  name: string
  version: string
  entrypoint: string
}

export interface MarketplacePlugin {
  id: string
  name: string
  description: string
  author: string
  version: string
}

// View state with type discriminator (for plugin settings navigation)
export type ViewState = 
  | { type: 'list' }
  | { type: 'detail'; pluginId: string }
  | { type: 'install'; pluginId?: string }
  | { type: 'manage-plugins'; targetPlugin?: string; targetMarketplace?: string; action?: string }
  | { type: 'manage-marketplaces'; targetMarketplace?: string; action?: 'add' | 'remove' | 'update' }
  | { type: 'discover-plugins'; targetPlugin?: string }
  | { type: 'marketplace-menu' }
  | { type: 'menu' }
  | { type: 'browse-marketplace'; targetMarketplace?: string; targetPlugin?: string }
  | { type: 'add-marketplace'; initialValue?: string }
  | { type: 'help' }
  | { type: 'validate'; path?: string }
  | { type: 'marketplace-list' }

// Extended view state (alias for backward compatibility)
export type ExtendedViewState = ViewState

export interface PluginSettingsProps {
  plugin: PluginConfig
  onUpdate: (config: PluginConfig) => void
}

// Unified plugin types
export interface UnifiedPlugin {
  id: string
  name: string
  description: string
  version: string
  type: 'local' | 'marketplace' | 'core'
  status: 'installed' | 'available' | 'update-available'
  config?: PluginConfig
}

export interface UnifiedPluginList {
  plugins: UnifiedPlugin[]
  installed: UnifiedPlugin[]
  available: UnifiedPlugin[]
}

export type UnifiedViewState = ExtendedViewState | { type: 'unified' }

// Re-export for unifiedTypes.js compatibility
export type { UnifiedPlugin as default }
