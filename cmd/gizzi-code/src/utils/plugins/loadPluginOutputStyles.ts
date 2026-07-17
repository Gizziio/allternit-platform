/**
 * Load Plugin Output Styles
 */

export interface PluginOutputStyle {
  name: string
  css?: string
}

export function loadPluginOutputStyles(): PluginOutputStyle[] {
  return []
}

/** Cache hook for the plugin output-style loader; no cache in this shim. */
export function clearPluginOutputStyleCache(): void {}
