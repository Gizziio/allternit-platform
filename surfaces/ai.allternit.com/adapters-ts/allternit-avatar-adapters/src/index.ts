/**
 * Allternit Avatar Adapters
 * 
 * Pluggable avatar rendering system for Allternit Visual State Protocol.
 * 
 * @example
 * ```typescript
 * import { getAdapterRegistry, createEmojiAdapter } from '@allternit/avatar-adapters';
 * 
 * const registry = getAdapterRegistry();
 * registry.register(createEmojiAdapter());
 * 
 * const adapter = registry.get('emoji');
 * const element = adapter.render(visualState, 'md');
 * ```
 */

// Types
export type {
  AvatarAdapter,
  AdapterRegistry,
  AdapterSettings,
  SVGAvatarConfig,
  EmojiAvatarConfig,
} from './types';

export { defaultAdapterSettings } from './types';

// Registry
export {
  createAdapterRegistry,
  getAdapterRegistry,
  loadAdapterSettings,
  saveAdapterSettings,
  getCurrentAdapter,
} from './registry';

// Adapters
export { createClawdAdapter, clawdAdapter } from './adapters/ClawdAdapter';
export { createEmojiAdapter, emojiAdapter } from './adapters/EmojiAdapter';

// Version
export const AVATAR_ADAPTERS_VERSION = '1.0.0';
