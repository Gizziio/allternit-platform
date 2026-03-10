/**
 * useFeaturePlugins Hook
 *
 * React hook for interacting with the feature plugin registry.
 * Provides reactive access to plugins with registration/unregistration capabilities.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { FeatureDefinition, FeaturePlugin } from './feature.types';
import {
  featureRegistry,
  FeatureRegistryError,
  toFeatureDefinition,
  FEATURE_PLUGIN_REGISTRY,
  type FeatureDefinition as RegistryFeatureDefinition,
} from './feature.registry';
import {
  getEnabledPluginIds,
  isPluginEnabled,
  subscribeToPluginChanges,
  togglePlugin,
} from './feature.store';

// Re-export error class for consumers
export { FeatureRegistryError } from './feature.registry';

/**
 * Return type for the useFeaturePlugins hook
 */
export interface UseFeaturePluginsReturn {
  /** All registered plugins */
  plugins: FeatureDefinition[];
  /** Currently enabled plugins */
  enabledPlugins: FeatureDefinition[];
  /** Set of enabled plugin IDs */
  enabledIds: Set<string>;
  /** Register a new plugin */
  registerPlugin: (plugin: FeatureDefinition | FeaturePlugin) => void;
  /** Unregister a plugin by ID */
  unregisterPlugin: (id: string) => boolean;
  /** Toggle a plugin's enabled state */
  toggle: (id: string) => void;
  /** Check if a plugin is enabled */
  isEnabled: (id: string) => boolean;
  /** Check if a plugin exists in the registry */
  hasPlugin: (id: string) => boolean;
  /** Get a specific plugin by ID */
  getPlugin: (id: string) => FeatureDefinition | undefined;
  /** All available plugins from legacy registry */
  allPlugins: FeaturePlugin[];
  /** Loading state for async operations */
  isLoading: boolean;
  /** Error state */
  error: FeatureRegistryError | null;
  /** Clear error state */
  clearError: () => void;
}

/**
 * Helper to read enabled plugins from the store
 */
function readEnabledSet(): Set<string> {
  return new Set(getEnabledPluginIds());
}

/**
 * Helper to convert plugin to FeatureDefinition
 */
function normalizePlugin(
  plugin: FeatureDefinition | FeaturePlugin
): RegistryFeatureDefinition {
  if ('views' in plugin && Array.isArray(plugin.views)) {
    // Check if it's already a FeatureDefinition (no icon property check needed as both have it)
    // We check for properties unique to FeaturePlugin
    const hasFeaturePluginProps =
      'enabledByDefault' in plugin || 'builtin' in plugin;

    if (hasFeaturePluginProps) {
      return toFeatureDefinition(plugin as FeaturePlugin);
    }
  }
  return plugin as RegistryFeatureDefinition;
}

/**
 * Hook for managing feature plugins with reactive updates
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { plugins, enabledPlugins, registerPlugin, toggle } = useFeaturePlugins();
 *
 *   return (
 *     <div>
 *       {plugins.map(plugin => (
 *         <div key={plugin.id}>
 *           {plugin.name} - {enabledPlugins.includes(plugin) ? 'Enabled' : 'Disabled'}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFeaturePlugins(): UseFeaturePluginsReturn {
  // Use sync external store for registry subscription
  const subscribeToRegistry = useCallback(
    (callback: () => void) => featureRegistry.subscribe(callback),
    []
  );

  const getSnapshot = useCallback(() => featureRegistry.list(), []);

  const getServerSnapshot = useCallback(() => featureRegistry.list(), []);

  // Subscribe to registry changes
  const plugins = useSyncExternalStore(
    subscribeToRegistry,
    getSnapshot,
    getServerSnapshot
  );

  // Local state for enabled IDs
  const [enabledIds, setEnabledIds] = useState<Set<string>>(readEnabledSet);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<FeatureRegistryError | null>(null);

  // Ref to track if component is mounted
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Subscribe to plugin changes from the store
  useEffect(() => {
    const unsubscribe = subscribeToPluginChanges(() => {
      if (isMounted.current) {
        setEnabledIds(readEnabledSet());
      }
    });
    return unsubscribe;
  }, []);

  /**
   * Register a new plugin
   */
  const registerPlugin = useCallback(
    (plugin: FeatureDefinition | FeaturePlugin) => {
      setIsLoading(true);
      setError(null);

      try {
        const normalizedPlugin = normalizePlugin(plugin);
        featureRegistry.register(normalizedPlugin);
      } catch (err) {
        if (err instanceof FeatureRegistryError) {
          setError(err);
          console.error('Failed to register plugin:', err.message);
        } else {
          const unknownError = new FeatureRegistryError(
            err instanceof Error ? err.message : 'Unknown error during registration',
            'INVALID_FEATURE'
          );
          setError(unknownError);
          console.error('Failed to register plugin:', unknownError.message);
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  /**
   * Unregister a plugin by ID
   */
  const unregisterPlugin = useCallback((id: string): boolean => {
    setError(null);

    try {
      return featureRegistry.unregister(id);
    } catch (err) {
      if (err instanceof FeatureRegistryError) {
        setError(err);
        console.error('Failed to unregister plugin:', err.message);
      }
      return false;
    }
  }, []);

  /**
   * Toggle a plugin's enabled state
   */
  const toggle = useCallback((id: string) => {
    togglePlugin(id);
    setEnabledIds(readEnabledSet());
  }, []);

  /**
   * Check if a plugin is enabled
   */
  const isEnabled = useCallback((id: string): boolean => {
    return isPluginEnabled(id);
  }, []);

  /**
   * Check if a plugin exists in the registry
   */
  const hasPlugin = useCallback((id: string): boolean => {
    return featureRegistry.has(id);
  }, []);

  /**
   * Get a specific plugin by ID
   */
  const getPlugin = useCallback(
    (id: string): FeatureDefinition | undefined => {
      return featureRegistry.get(id);
    },
    []
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Memoized enabled plugins list
  const enabledPlugins = useMemo(() => {
    return plugins.filter((plugin) => enabledIds.has(plugin.id));
  }, [plugins, enabledIds]);

  // Import FEATURE_PLUGIN_REGISTRY for backward compatibility - use static import
  const [legacyRegistry, setLegacyRegistry] = useState<any>(FEATURE_PLUGIN_REGISTRY);

  return {
    // Registry-based plugins (reactive)
    plugins: plugins as FeatureDefinition[],
    enabledPlugins: enabledPlugins as FeatureDefinition[],
    enabledIds,
    registerPlugin,
    unregisterPlugin,
    toggle,
    isEnabled,
    hasPlugin,
    getPlugin,
    // Legacy support
    allPlugins: legacyRegistry as FeaturePlugin[],
    // Status
    isLoading,
    error,
    clearError,
  };
}

/**
 * Simplified hook that only returns plugins and basic operations
 * Use this when you don't need the full feature set
 */
export function usePlugins(): Pick<
  UseFeaturePluginsReturn,
  'plugins' | 'enabledPlugins' | 'enabledIds' | 'toggle' | 'isEnabled'
> {
  const { plugins, enabledPlugins, enabledIds, toggle, isEnabled } =
    useFeaturePlugins();

  return useMemo(
    () => ({
      plugins,
      enabledPlugins,
      enabledIds,
      toggle,
      isEnabled,
    }),
    [plugins, enabledPlugins, enabledIds, toggle, isEnabled]
  );
}

/**
 * Hook for managing a single plugin
 *
 * @param pluginId - The ID of the plugin to manage
 */
export function usePlugin(pluginId: string): {
  plugin: FeatureDefinition | undefined;
  isEnabled: boolean;
  toggle: () => void;
  exists: boolean;
} {
  const { getPlugin, isEnabled, toggle, hasPlugin } = useFeaturePlugins();

  const plugin = useMemo(() => getPlugin(pluginId), [getPlugin, pluginId]);

  const enabled = useMemo(() => isEnabled(pluginId), [isEnabled, pluginId]);

  const handleToggle = useCallback(() => {
    toggle(pluginId);
  }, [toggle, pluginId]);

  return {
    plugin,
    isEnabled: enabled,
    toggle: handleToggle,
    exists: hasPlugin(pluginId),
  };
}

// Default export
export default useFeaturePlugins;
