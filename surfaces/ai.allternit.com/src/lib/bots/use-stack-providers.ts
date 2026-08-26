/**
 * useStackProviders Hook
 *
 * Initializes the multi-platform agent stack on mount:
 * - Registers Hermes, OpenClaw, and Kimi providers.
 * - Starts polling for external agents.
 * - Returns the current stacked agents and loading state.
 *
 * @module use-stack-providers
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { registerDefaultStackProviders } from './stack-providers/init';
import {
  stackedAgentService,
  externalToAgent,
  type StackedAgent,
  type StackedAgentSyncState,
} from './stacked-agent.service';

export interface UseStackProvidersResult {
  stackedAgents: StackedAgent[];
  isLoading: boolean;
  error: string | null;
  lastSyncedAt: string | null;
}

export function useStackProviders(): UseStackProvidersResult {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    registerDefaultStackProviders();
    setInitialized(true);

    return () => {
      stackedAgentService.stopPolling();
    };
  }, []);

  const state = useSyncExternalStore(
    (callback) => stackedAgentService.subscribe(callback),
    () => stackedAgentService.getState(),
    () => ({
      agents: [],
      isLoading: false,
      error: null,
      lastSyncedAt: null,
    })
  );

  return {
    stackedAgents: initialized ? state.agents : [],
    isLoading: state.isLoading,
    error: state.error,
    lastSyncedAt: state.lastSyncedAt,
  };
}

export { externalToAgent };
