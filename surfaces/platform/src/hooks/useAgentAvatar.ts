/**
 * useAgentAvatar Hook
 *
 * Provides agent visual state and avatar rendering utilities.
 */

import { useCallback, useEffect } from 'react';
import { useVisualStateStore, createTelemetryEvent, subscribeToAgentState } from '@/stores/visual-state.store';
import type { VisualState, TelemetryEvent } from '@a2r/visual-state/types';
import type { AvatarSize } from '@a2r/visual-state/types';

export interface UseAgentAvatarOptions {
  /** Agent ID to track */
  agentId: string;
  /** Default avatar size */
  size?: AvatarSize;
  /** Enable animations */
  animate?: boolean;
  /** Reduced motion preference */
  reducedMotion?: boolean;
  /** Auto-subscribe to telemetry events */
  autoSubscribe?: boolean;
}

export interface UseAgentAvatarReturn {
  /** Current visual state */
  visualState: VisualState | undefined;
  /** Send telemetry event */
  sendTelemetry: (event: Omit<TelemetryEvent, 'agentId'>) => void;
  /** Clear agent state */
  clearState: () => void;
  /** Get history */
  getHistory: () => import('@/stores/visual-state.store').VisualStateHistoryEntry[];
}

/**
 * Hook for managing agent avatar visual state
 */
export function useAgentAvatar({
  agentId,
  size = 'md',
  animate = true,
  reducedMotion = false,
  autoSubscribe = true,
}: UseAgentAvatarOptions): UseAgentAvatarReturn {
  // Get current state from store
  const visualState = useVisualStateStore(
    useCallback((state) => state.states.get(agentId), [agentId])
  );

  // Send telemetry event
  const sendTelemetry = useCallback(
    (event: Omit<TelemetryEvent, 'agentId'>) => {
      useVisualStateStore.getState().processTelemetry({
        ...event,
        agentId,
      });
    },
    [agentId]
  );

  // Clear state
  const clearState = useCallback(() => {
    useVisualStateStore.getState().clearState(agentId);
  }, [agentId]);

  // Get history
  const getHistory = useCallback(() => {
    return useVisualStateStore.getState().getHistory(agentId);
  }, [agentId]);

  // Auto-subscribe to state changes for debugging
  useEffect(() => {
    if (!autoSubscribe) return;

    const unsubscribe = subscribeToAgentState(agentId, (state) => {
      if (state) {
        console.debug(`[Avatar] Agent ${agentId}: ${state.mood} (${state.intensity}/10)`);
      }
    });

    return unsubscribe;
  }, [agentId, autoSubscribe]);

  return {
    visualState,
    sendTelemetry,
    clearState,
    getHistory,
  };
}

/**
 * Default visual state for when agent is idle
 */
export const DEFAULT_VISUAL_STATE: VisualState = {
  mood: 'idle' as import('@a2r/visual-state/types').Mood,
  intensity: 2 as import('@a2r/visual-state/types').IntensityLevel,
  confidence: 1.0,
  reliability: 1.0,
  timestamp: new Date(),
  source: 'default',
};
