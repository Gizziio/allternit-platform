/**
 * Feature Plugin Registry
 *
 * A centralized registry for managing feature plugins within the application.
 * Provides registration, unregistration, and lookup capabilities with full TypeScript support.
 */

import type { FeaturePlugin, PluginCategory, RailSection, PluginViewEntry } from './feature.types';
import { OFFICE_PLUGINS } from './office-plugins';
import { CHROME_PLUGIN } from './chrome-plugin';

// Re-export types for convenience
export type { FeaturePlugin, PluginCategory, RailSection, PluginViewEntry };

/**
 * Feature definition interface for registry operations
 */
export interface FeatureDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  icon: string;
  category: PluginCategory;
  author?: string;
  accentColor?: string;
  views: PluginViewEntry[];
  enabledByDefault?: boolean;
  tags?: string[];
  builtin?: boolean;
  /**
   * Optional metadata for extensibility
   */
  metadata?: Record<string, unknown>;
}

/**
 * Interface for the feature registry implementation
 */
export interface FeatureRegistryInterface {
  register(feature: FeatureDefinition): void;
  unregister(id: string): boolean;
  get(id: string): FeatureDefinition | undefined;
  list(): readonly FeatureDefinition[];
  has(id: string): boolean;
  clear(): void;
}

/**
 * Error thrown when a feature registration fails
 */
export class FeatureRegistryError extends Error {
  constructor(
    message: string,
    public readonly code: 'DUPLICATE_ID' | 'INVALID_FEATURE' | 'NOT_FOUND' | 'REGISTRY_LOCKED'
  ) {
    super(message);
    this.name = 'FeatureRegistryError';
    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, FeatureRegistryError.prototype);
  }
}

/**
 * FeatureRegistry class - singleton pattern for managing feature plugins
 *
 * @example
 * ```typescript
 * const registry = FeatureRegistry.getInstance();
 * registry.register({
 *   id: 'my-feature',
 *   name: 'My Feature',
 *   version: '1.0.0',
 *   description: 'A new feature',
 *   icon: 'Star',
 *   category: 'productivity',
 *   views: []
 * });
 * ```
 */
class FeatureRegistry implements FeatureRegistryInterface {
  private static instance: FeatureRegistry | null = null;
  private features: Map<string, FeatureDefinition> = new Map();
  private listeners: Set<(features: FeatureDefinition[]) => void> = new Set();
  private locked = false;
  private cachedList: readonly FeatureDefinition[] | null = null;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Get the singleton instance of the FeatureRegistry
   */
  static getInstance(): FeatureRegistry {
    if (!FeatureRegistry.instance) {
      FeatureRegistry.instance = new FeatureRegistry();
    }
    return FeatureRegistry.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    FeatureRegistry.instance = null;
  }

  /**
   * Register a new feature
   *
   * @param feature - The feature definition to register
   * @throws {FeatureRegistryError} If feature is invalid or ID already exists
   */
  register(feature: FeatureDefinition): void {
    if (this.locked) {
      throw new FeatureRegistryError(
        'Registry is locked and cannot be modified',
        'REGISTRY_LOCKED'
      );
    }

    // Validate required fields
    if (!feature.id || typeof feature.id !== 'string') {
      throw new FeatureRegistryError(
        'Feature must have a valid id string',
        'INVALID_FEATURE'
      );
    }

    if (!feature.name || typeof feature.name !== 'string') {
      throw new FeatureRegistryError(
        'Feature must have a valid name string',
        'INVALID_FEATURE'
      );
    }

    if (this.features.has(feature.id)) {
      throw new FeatureRegistryError(
        `Feature with id "${feature.id}" is already registered`,
        'DUPLICATE_ID'
      );
    }

    // Ensure defaults
    const featureWithDefaults: FeatureDefinition = {
      enabledByDefault: false,
      builtin: false,
      tags: [],
      ...feature,
      views: feature.views ?? [],
    };

    this.features.set(feature.id, featureWithDefaults);
    this.notifyListeners();
  }

  /**
   * Unregister a feature by ID
   *
   * @param id - The feature ID to unregister
   * @returns true if the feature was removed, false if not found
   * @throws {FeatureRegistryError} If registry is locked
   */
  unregister(id: string): boolean {
    if (this.locked) {
      throw new FeatureRegistryError(
        'Registry is locked and cannot be modified',
        'REGISTRY_LOCKED'
      );
    }

    const existed = this.features.has(id);
    if (existed) {
      this.features.delete(id);
      this.notifyListeners();
    }
    return existed;
  }

  /**
   * Get a feature by ID
   *
   * @param id - The feature ID to look up
   * @returns The feature definition or undefined if not found
   */
  get(id: string): FeatureDefinition | undefined {
    return this.features.get(id);
  }

  /**
   * Get all registered features as an array
   *
   * @returns Readonly array of all feature definitions
   */
  list(): readonly FeatureDefinition[] {
    if (this.cachedList === null) {
      this.cachedList = Object.freeze(Array.from(this.features.values()));
    }
    return this.cachedList;
  }

  /**
   * Check if a feature with the given ID exists
   *
   * @param id - The feature ID to check
   * @returns true if the feature exists
   */
  has(id: string): boolean {
    return this.features.has(id);
  }

  /**
   * Clear all registered features
   *
   * @throws {FeatureRegistryError} If registry is locked
   */
  clear(): void {
    if (this.locked) {
      throw new FeatureRegistryError(
        'Registry is locked and cannot be modified',
        'REGISTRY_LOCKED'
      );
    }

    const hadFeatures = this.features.size > 0;
    this.features.clear();
    if (hadFeatures) {
      this.notifyListeners();
    }
  }

  /**
   * Lock the registry to prevent further modifications
   * Useful for production builds or after initialization
   */
  lock(): void {
    this.locked = true;
  }

  /**
   * Check if the registry is locked
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Subscribe to registry changes
   *
   * @param callback - Function to call when registry changes
   * @returns Unsubscribe function
   */
  subscribe(callback: (features: FeatureDefinition[]) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Get the count of registered features
   */
  get size(): number {
    return this.features.size;
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    // Invalidate cache before notifying listeners
    this.cachedList = null;
    const features = this.list();
    this.listeners.forEach((listener) => {
      try {
        listener(features as FeatureDefinition[]);
      } catch (error) {
        console.error('Error in feature registry listener:', error);
      }
    });
  }
}

/**
 * Singleton instance of the FeatureRegistry
 */
export const featureRegistry = FeatureRegistry.getInstance();

/**
 * Legacy constant registry for backward compatibility
 * This is the static array that was previously exported
 */
export const FEATURE_PLUGIN_REGISTRY: FeaturePlugin[] = [
  {
    id: 'core',
    name: 'Core Features',
    version: '1.0.0',
    description: 'Basic agent functionality',
    icon: 'Cpu',
    category: 'productivity',
    enabledByDefault: true,
    builtin: true,
    views: [],
  },
  {
    id: 'advanced',
    name: 'Advanced Features',
    version: '1.0.0',
    description: 'Extended capabilities',
    icon: 'Zap',
    category: 'experimental',
    enabledByDefault: false,
    builtin: true,
    views: [],
  },
  ...OFFICE_PLUGINS,
  CHROME_PLUGIN,
];

/**
 * Helper function to convert legacy FeaturePlugin to FeatureDefinition
 */
export function toFeatureDefinition(plugin: FeaturePlugin): FeatureDefinition {
  return {
    id: plugin.id,
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    icon: plugin.icon,
    category: plugin.category,
    author: plugin.author,
    accentColor: plugin.accentColor,
    views: plugin.views,
    enabledByDefault: plugin.enabledByDefault,
    tags: plugin.tags,
    builtin: plugin.builtin,
  };
}

/**
 * Initialize the registry with the legacy plugins
 * Call this during app initialization to populate the registry
 */
export function initializeFeatureRegistry(): void {
  FEATURE_PLUGIN_REGISTRY.forEach((plugin) => {
    try {
      featureRegistry.register(toFeatureDefinition(plugin));
    } catch (error) {
      // Ignore duplicate registration errors during initialization
      if (
        error instanceof FeatureRegistryError &&
        error.code === 'DUPLICATE_ID'
      ) {
        return;
      }
      throw error;
    }
  });
}

// Default export for convenience
export default FeatureRegistry;
