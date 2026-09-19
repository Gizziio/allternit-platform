/**
 * Plugin Types
 * TEMPORARY SHIM
 *
 * ViewState / PluginSettingsProps were referenced by the committed compiler
 * artifacts since the root commit but never existed in this shim; the unions
 * below are recovered from the decompiled consumers (PluginSettings,
 * DiscoverPlugins, ManageMarketplaces) and their setViewState call sites.
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

// Parent screen view state, threaded through every plugin sub-screen's
// setViewState prop.
export type ViewState =
  | { type: 'menu' }
  | { type: 'help' }
  | { type: 'validate'; path: string }
  | { type: 'marketplace-list' }
  | { type: 'marketplace-menu' }
  | { type: 'discover-plugins'; targetPlugin?: string }
  | { type: 'manage-plugins'; targetPlugin?: string; targetMarketplace?: string; action?: 'enable' | 'disable' | 'uninstall' }
  | { type: 'manage-marketplaces'; targetMarketplace?: string; action?: 'update' | 'remove' }
  | { type: 'add-marketplace'; initialValue?: string }
  | { type: 'browse-marketplace'; targetMarketplace: string; targetPlugin?: string }

export type PluginSettingsProps = {
  onComplete: (result?: string) => void
  args?: string
  showMcpRedirectMessage?: boolean
}

export default { }
