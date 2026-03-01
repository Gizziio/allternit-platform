/**
 * Feature Flags Configuration
 *
 * Centralized feature flag management for the shell.
 * Flags can be overridden via localStorage for development.
 *
 * Priority order:
 * 1. localStorage override (for dev/testing)
 * 2. Environment variable (VITE_FEATURE_*)
 * 3. Default value
 */

import { FEATURE_FLAGS, type FeatureFlagKey } from './featureFlagsDefaults';

// Re-export defaults for convenience
export { FEATURE_FLAGS };
export type { FeatureFlagKey };

const STORAGE_KEY = 'a2rchitech-feature-flags';

/**
 * Get raw default value for a flag
 */
function getDefaultValue<K extends FeatureFlagKey>(key: K): typeof FEATURE_FLAGS[K] {
  return FEATURE_FLAGS[key];
}

/**
 * Get the current value of a feature flag
 * Priority: localStorage > env > default
 */
export function getFeatureFlag<K extends FeatureFlagKey>(key: K): typeof FEATURE_FLAGS[K] {
  // 1. Check localStorage override (for dev)
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (key in parsed) {
          return parsed[key] as typeof FEATURE_FLAGS[K];
        }
      }
    } catch {
      // localStorage not available or corrupted, continue to defaults
    }
  }

  // 2. Check environment variable (VITE_FEATURE_ENABLE_AVATAR_PRESENCE)
  const envKey = `VITE_FEATURE_${key.toUpperCase()}`;
  if (typeof process !== 'undefined' && process.env?.[envKey] !== undefined) {
    const envValue = process.env[envKey];
    if (envValue === 'true' || envValue === '1') return true as any;
    if (envValue === 'false' || envValue === '0') return false as any;
  }

  // 3. Fall back to default
  return getDefaultValue(key);
}

/**
 * Set a feature flag override (for dev/testing)
 */
export function setFeatureFlag<K extends FeatureFlagKey>(
  key: K,
  value: typeof FEATURE_FLAGS[K]
): void {
  if (typeof window === 'undefined') return;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    parsed[key] = value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));

    // Dispatch event for live updates
    window.dispatchEvent(new CustomEvent('featureFlagsChanged'));
  } catch {
    console.warn('[FeatureFlags] Failed to save to localStorage');
  }
}

/**
 * Clear all feature flag overrides
 */
export function clearFeatureFlagOverrides(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('featureFlagsChanged'));
}

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  return getFeatureFlag(key) === true;
}

/**
 * Get all current flag values (for debugging)
 */
export function getAllFeatureFlags(): Record<string, boolean> {
  const result: Record<string, boolean> = {} as any;
  for (const key of Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]) {
    result[key] = isFeatureEnabled(key);
  }
  return result;
}
