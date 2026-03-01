/**
 * useFeaturePlugins
 *
 * React hook for consuming and managing feature plugin state.
 * Re-renders any component that calls this whenever a plugin is toggled.
 */

import { useState, useCallback, useEffect } from 'react';
import { FEATURE_PLUGIN_REGISTRY } from './feature.registry';
import type { FeaturePlugin } from './feature.types';
import {
  getEnabledPluginIds,
  togglePlugin as storeToggle,
  enablePlugin as storeEnable,
  disablePlugin as storeDisable,
  subscribeToPluginChanges,
} from './feature.store';

export function useFeaturePlugins() {
  const [enabledIds, setEnabledIds] = useState<Set<string>>(
    () => new Set(getEnabledPluginIds()),
  );

  // Stay in sync when another component toggles a plugin
  useEffect(() => {
    const unsubscribe = subscribeToPluginChanges(() => {
      setEnabledIds(new Set(getEnabledPluginIds()));
    });
    return unsubscribe;
  }, []);

  const toggle = useCallback((id: string) => {
    storeToggle(id);
    setEnabledIds(new Set(getEnabledPluginIds()));
  }, []);

  const enable = useCallback((id: string) => {
    storeEnable(id);
    setEnabledIds(new Set(getEnabledPluginIds()));
  }, []);

  const disable = useCallback((id: string) => {
    storeDisable(id);
    setEnabledIds(new Set(getEnabledPluginIds()));
  }, []);

  const isEnabled = useCallback(
    (id: string) => enabledIds.has(id),
    [enabledIds],
  );

  const enabledPlugins: FeaturePlugin[] = FEATURE_PLUGIN_REGISTRY.filter((p) =>
    enabledIds.has(p.id),
  );

  return {
    /** All plugins (enabled + disabled) */
    allPlugins: FEATURE_PLUGIN_REGISTRY,
    /** Only currently-enabled plugins */
    enabledPlugins,
    /** Set of enabled plugin IDs */
    enabledIds,
    toggle,
    enable,
    disable,
    isEnabled,
  };
}
