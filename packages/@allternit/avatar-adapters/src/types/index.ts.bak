/**
 * Avatar Adapter Types
 * 
 * Defines the interface for pluggable avatar renderers.
 */

import type { VisualState, AvatarSize, Mood } from '@allternit/visual-state/types';

/**
 * Avatar adapter interface
 * Implement this to create custom avatar renderers
 */
export interface AvatarAdapter {
  /** Unique adapter name */
  name: string;
  /** Display name for UI */
  displayName: string;
  /** Render function - returns React element */
  render: (state: VisualState, size: AvatarSize) => React.ReactNode;
  /** Supported moods */
  supportedMoods: Mood[];
  /** Whether adapter supports intensity scaling */
  supportsIntensity: boolean;
  /** Whether adapter supports confidence display */
  supportsConfidence: boolean;
  /** Whether adapter supports reliability display */
  supportsReliability: boolean;
  /** Adapter description */
  description?: string;
  /** Preview component for settings */
  PreviewComponent?: React.ComponentType<{ size?: AvatarSize }>;
}

/**
 * Adapter registry
 */
export interface AdapterRegistry {
  /** Registered adapters */
  adapters: Map<string, AvatarAdapter>;
  /** Get adapter by name */
  get(name: string): AvatarAdapter | undefined;
  /** Register new adapter */
  register(adapter: AvatarAdapter): void;
  /** Unregister adapter */
  unregister(name: string): void;
  /** Get all adapters */
  getAll(): AvatarAdapter[];
  /** Get default adapter */
  getDefault(): AvatarAdapter;
}

/**
 * SVG avatar configuration
 */
export interface SVGAvatarConfig {
  /** Base SVG for each mood */
  moodSVGs: Record<Mood, string>;
  /** Color overrides */
  colors?: Record<Mood, string>;
  /** Animation CSS */
  animations?: Record<Mood, string>;
}

/**
 * Emoji avatar configuration
 */
export interface EmojiAvatarConfig {
  /** Emoji for each mood */
  moodEmojis: Record<Mood, string>;
  /** Size multipliers */
  sizeScale?: Record<AvatarSize, number>;
}

/**
 * Adapter settings
 */
export interface AdapterSettings {
  /** Selected adapter name */
  adapter: string;
  /** Animation enabled */
  animate: boolean;
  /** Show confidence indicator */
  showConfidence: boolean;
  /** Show reliability indicator */
  showReliability: boolean;
  /** Custom colors per mood */
  customColors?: Partial<Record<Mood, string>>;
  /** Animation speed multiplier */
  animationSpeed: number;
}

/**
 * Default adapter settings
 */
export const defaultAdapterSettings: AdapterSettings = {
  adapter: 'default',
  animate: true,
  showConfidence: true,
  showReliability: true,
  animationSpeed: 1.0,
};
