/**
 * Growthbook feature flag integration
 * A/B testing and feature management
 */

import { GrowthBook } from '@growthbook/growthbook'
import { log } from '../../runtime/util/log.js'
import { trackEvent } from './index.js'

// Growthbook client
let growthbook: GrowthBook | null = null
let isInitialized = false

export interface GrowthbookConfig {
  apiHost?: string
  clientKey: string
  enableDevMode?: boolean
  subscribeToChanges?: boolean
  attributes?: Record<string, unknown>
}

export async function initializeGrowthbook(config: GrowthbookConfig): Promise<void> {
  if (isInitialized) {
    log('debug', 'Growthbook already initialized')
    return
  }

  try {
    growthbook = new GrowthBook({
      apiHost: config.apiHost || 'https://cdn.growthbook.io',
      clientKey: config.clientKey,
      enableDevMode: config.enableDevMode ?? process.env.NODE_ENV === 'development',
      subscribeToChanges: config.subscribeToChanges ?? true,
      attributes: config.attributes || {},
      trackingCallback: (experiment, result) => {
        trackEvent('experiment.viewed', {
          experimentId: experiment.key,
          variationId: result.variationId,
        })
      },
    })

    await growthbook.init()
    isInitialized = true
    log('info', 'Growthbook initialized')
  } catch (error) {
    log('error', 'Failed to initialize Growthbook', error)
    throw error
  }
}

export function getGrowthbook(): GrowthBook | null {
  return growthbook
}

// Feature flag evaluation
export function isFeatureEnabled(featureKey: string): boolean {
  if (!growthbook) {
    log('debug', `Growthbook not initialized, returning false for ${featureKey}`)
    return false
  }
  return growthbook.isOn(featureKey)
}

export function getFeatureValue<T>(featureKey: string, defaultValue: T): T {
  if (!growthbook) {
    return defaultValue
  }
  return growthbook.getFeatureValue(featureKey, defaultValue)
}

// Cached version for frequent access
const featureCache = new Map<string, unknown>()

export function getFeatureValue_CACHED_MAY_BE_STALE<T>(featureKey: string, defaultValue: T): T {
  const cached = featureCache.get(featureKey)
  if (cached !== undefined) {
    return cached as T
  }
  
  const value = getFeatureValue(featureKey, defaultValue)
  featureCache.set(featureKey, value)
  return value
}

export function clearFeatureCache(): void {
  featureCache.clear()
}

// A/B testing
export function runExperiment<T>(experimentKey: string, variations: T[]): T {
  if (!growthbook) {
    return variations[0]
  }
  
  const result = growthbook.run({
    key: experimentKey,
    variations,
  })
  
  return result.value
}

// Attributes
export function setAttributes(attributes: Record<string, unknown>): void {
  if (!growthbook) {
    log('warn', 'Cannot set attributes, Growthbook not initialized')
    return
  }
  growthbook.setAttributes({
    ...growthbook.getAttributes(),
    ...attributes,
  })
}

export function getAttributes(): Record<string, unknown> {
  if (!growthbook) {
    return {}
  }
  return growthbook.getAttributes()
}

// Helpers
export function getFeatureKeys(): string[] {
  if (!growthbook) {
    return []
  }
  // Access internal features (typed as any since it's internal)
  const features = (growthbook as any).features || {}
  return Object.keys(features)
}

export function refreshFeatures(): Promise<void> {
  if (!growthbook) {
    return Promise.resolve()
  }
  clearFeatureCache()
  return growthbook.refreshFeatures()
}

// Specific feature flags (common patterns)
export function isAnalyticsEnabled(): boolean {
  return isFeatureEnabled('analytics_enabled')
}

export function isTelemetryEnabled(): boolean {
  return isFeatureEnabled('telemetry_enabled')
}

export function isNewUIEnabled(): boolean {
  return isFeatureEnabled('new_ui_enabled')
}

export function getMaxToolIterations(): number {
  return getFeatureValue('max_tool_iterations', 50)
}

export function getRateLimitMultiplier(): number {
  return getFeatureValue('rate_limit_multiplier', 1.0)
}

// Cleanup
export function destroyGrowthbook(): void {
  if (growthbook) {
    growthbook.destroy()
    growthbook = null
    isInitialized = false
    clearFeatureCache()
  }
}

// Default export
export default {
  initializeGrowthbook,
  getGrowthbook,
  isFeatureEnabled,
  getFeatureValue,
  getFeatureValue_CACHED_MAY_BE_STALE,
  clearFeatureCache,
  runExperiment,
  setAttributes,
  getAttributes,
  getFeatureKeys,
  refreshFeatures,
  isAnalyticsEnabled,
  isTelemetryEnabled,
  isNewUIEnabled,
  getMaxToolIterations,
  getRateLimitMultiplier,
  destroyGrowthbook,
}
