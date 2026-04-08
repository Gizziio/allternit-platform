/**
 * Avatar Adapter Registry
 * 
 * Central registry for avatar adapters with localStorage persistence.
 */

import type { AvatarAdapter, AdapterRegistry, AdapterSettings } from './types';
import { defaultAdapterSettings } from './types';
import { clawdAdapter } from './adapters/ClawdAdapter';
import { emojiAdapter } from './adapters/EmojiAdapter';

const STORAGE_KEY = 'allternit_avatar_settings';

/**
 * Create adapter registry
 */
export function createAdapterRegistry(): AdapterRegistry {
  const adapters = new Map<string, AvatarAdapter>();
  
  // Register default adapters
  adapters.set(clawdAdapter.name, clawdAdapter);
  adapters.set(emojiAdapter.name, emojiAdapter);
  
  return {
    adapters,
    
    get(name: string): AvatarAdapter | undefined {
      return adapters.get(name);
    },
    
    register(adapter: AvatarAdapter): void {
      adapters.set(adapter.name, adapter);
    },
    
    unregister(name: string): void {
      adapters.delete(name);
    },
    
    getAll(): AvatarAdapter[] {
      return Array.from(adapters.values());
    },
    
    getDefault(): AvatarAdapter {
      return adapters.get('clawd') || adapters.get('emoji') || Array.from(adapters.values())[0]!;
    },
  };
}

/**
 * Global registry instance
 */
let globalRegistry: AdapterRegistry | null = null;

export function getAdapterRegistry(): AdapterRegistry {
  if (!globalRegistry) {
    globalRegistry = createAdapterRegistry();
  }
  return globalRegistry;
}

/**
 * Load adapter settings from localStorage
 */
export function loadAdapterSettings(): AdapterSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultAdapterSettings, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore localStorage errors
  }
  return defaultAdapterSettings;
}

/**
 * Save adapter settings to localStorage
 */
export function saveAdapterSettings(settings: AdapterSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Get current adapter from settings
 */
export function getCurrentAdapter(settings?: AdapterSettings): AvatarAdapter {
  const registry = getAdapterRegistry();
  const s = settings || loadAdapterSettings();
  return registry.get(s.adapter) || registry.getDefault();
}
