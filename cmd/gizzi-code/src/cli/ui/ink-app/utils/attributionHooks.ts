/**
 * Attribution Hooks
 * TEMPORARY SHIM
 */

export interface AttributionInfo {
  source: string
  license?: string
  author?: string
}
export function getAttribution(content: string): AttributionInfo[] {
  return []
export function clearAttributionCaches(): void {
  // Placeholder
export function sweepFileContentCache(): void {
export function registerAttributionHooks(): void {
export default { getAttribution, clearAttributionCaches, sweepFileContentCache, registerAttributionHooks }
}
}
}
}
