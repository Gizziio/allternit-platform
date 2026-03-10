/**
 * useCliToolsApi Hook
 * 
 * Combines local CLI tool state with API-fetched data.
 * Provides real-time discovery from system PATH.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CliTool } from './capability.types';
import { getEnabledIds, enable, disable, isEnabled, subscribeToCapabilityChanges } from './capabilityEnabled.store';
import {
  fetchCliToolsFromApi,
  installCliTool,
  uninstallCliTool,
  discoverCliTools,
  type CliToolApiResponse,
} from './cli-tools.api';

// ============================================================================
// Types
// ============================================================================

export interface UseCliToolsApiReturn {
  /** CLI tools (merged local + API data) */
  cliTools: CliTool[];
  /** Currently enabled CLI tool IDs */
  enabledIds: Set<string>;
  /** Whether API data is loading */
  isLoading: boolean;
  /** Error message if API call failed */
  error: string | null;
  /** Toggle a CLI tool on/off */
  toggle: (id: string) => void;
  /** Check if a CLI tool is enabled */
  isEnabled: (id: string) => boolean;
  /** Install a CLI tool via package manager */
  install: (id: string, method?: string) => Promise<{ success: boolean; message: string }>;
  /** Uninstall a CLI tool */
  uninstall: (id: string) => Promise<{ success: boolean; message: string }>;
  /** Refresh CLI tools from API */
  refresh: () => Promise<void>;
  /** Discover new CLI tools from system PATH */
  discover: () => Promise<void>;
  /** Whether discovery is in progress */
  isDiscovering: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert API model to capability model used by plugin manager.
 */
function mapApiTool(api: CliToolApiResponse): CliTool {
  return {
    id: api.id,
    type: 'cli-tool',
    name: api.name,
    description: api.description,
    command: api.command,
    installCommands: {},
    checkCommand: `${api.command} --version`,
    category: api.category,
    tags: api.tags,
    enabledByDefault: false,
    installed: api.installed,
    version: api.version,
  };
}

/**
 * Merge API responses by id while preserving existing entries.
 */
function mergeById(current: CliTool[], incoming: CliTool[]): CliTool[] {
  const map = new Map(current.map((tool) => [tool.id, tool]));
  for (const tool of incoming) {
    const previous = map.get(tool.id);
    map.set(tool.id, previous ? { ...previous, ...tool } : tool);
  }
  return Array.from(map.values());
}

// ============================================================================
// Hook
// ============================================================================

export function useCliToolsApi(): UseCliToolsApiReturn {
  const [cliTools, setCliTools] = useState<CliTool[]>([]);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(() => {
    return new Set(getEnabledIds('cli-tool'));
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track if initial fetch has happened
  const hasFetchedRef = useRef(false);

  /**
   * Fetch CLI tools from API and merge with local state
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const apiTools = await fetchCliToolsFromApi();
      setCliTools(apiTools.map(mapApiTool));
      setEnabledIds(new Set(getEnabledIds('cli-tool')));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch CLI tools');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Discover new CLI tools from system PATH
   */
  const discover = useCallback(async () => {
    setIsDiscovering(true);
    setError(null);
    
    try {
      const discovered = await discoverCliTools();
      const discoveredTools = discovered.map(mapApiTool);
      setCliTools((current) => mergeById(current, discoveredTools));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover CLI tools');
    } finally {
      setIsDiscovering(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      refresh();
    }
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = subscribeToCapabilityChanges('cli-tool', () => {
      setEnabledIds(new Set(getEnabledIds('cli-tool')));
    });
    return unsubscribe;
  }, []);

  /**
   * Toggle a CLI tool on/off
   */
  const toggle = useCallback((id: string) => {
    const currentlyEnabled = isEnabled('cli-tool', id);
    if (currentlyEnabled) {
      disable('cli-tool', id);
    } else {
      enable('cli-tool', id);
    }
    
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /**
   * Check if a CLI tool is enabled
   */
  const checkEnabled = useCallback((id: string) => {
    return enabledIds.has(id);
  }, [enabledIds]);

  /**
   * Install a CLI tool
   */
  const install = useCallback(async (id: string, method?: string) => {
    const result = await installCliTool(id, method);
    
    if (result.success) {
      // Refresh to get updated installation status
      await refresh();
    }
    
    return result;
  }, [refresh]);

  /**
   * Uninstall a CLI tool
   */
  const uninstall = useCallback(async (id: string) => {
    const result = await uninstallCliTool(id);
    
    if (result.success) {
      // Refresh to get updated installation status
      await refresh();
    }
    
    return result;
  }, [refresh]);

  return {
    cliTools,
    enabledIds,
    isLoading,
    error,
    toggle,
    isEnabled: checkEnabled,
    install,
    uninstall,
    refresh,
    discover,
    isDiscovering,
  };
}
