/**
 * Feature Flags Defaults
 *
 * Default values for all feature flags.
 * Never import this directly - use featureFlags.ts instead.
 */

// Default values - all features OFF by default
export const FEATURE_FLAGS = {
  // Avatar presence - when enabled, shows Gizzi avatar alongside VoiceOrb
  // based on ActivityCenter state
  enableAvatarPresence: false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;
