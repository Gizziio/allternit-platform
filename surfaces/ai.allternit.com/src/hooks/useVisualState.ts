/**
 * useVisualState Hook
 * 
 * React hook for accessing agent visual state.
 */

import { useState, useEffect, useCallback } from 'react';
import type { VisualState, TelemetryEvent } from '@allternit/visual-state/types';
import { MoodInferrer, getMoodInferrer } from '@allternit/visual-state/inference';

export interface UseVisualStateReturn {
  /** Current visual state */
  visualState: VisualState | null;
  /** Visual state history */
  history: Array<{ state: VisualState; triggeredBy: TelemetryEvent }>;
  /** Update state manually */
  updateState: (event: TelemetryEvent) => void;
  /** Clear history */
  clearHistory: () => void;
  /** Whether inferrer is ready */
  isReady: boolean;
}

/**
 * Hook for accessing and managing agent visual state
 */
export function useVisualState(agentId: string): UseVisualStateReturn {
  const [visualState, setVisualState] = useState<VisualState | null>(null);
  const [history, setHistory] = useState<Array<{ state: VisualState; triggeredBy: TelemetryEvent }>>([]);
  const [isReady, setIsReady] = useState(false);

  const inferrer = getMoodInferrer();

  useEffect(() => {
    setIsReady(true);
    
    // Load initial history
    const initialHistory = inferrer.getHistory(agentId);
    setHistory(initialHistory);
    
    const current = inferrer.getCurrentState(agentId);
    if (current) {
      setVisualState(current);
    }
  }, [agentId, inferrer]);

  const updateState = useCallback((event: TelemetryEvent) => {
    const result = inferrer.infer(event);
    
    if (result) {
      setVisualState(result.state);
      setHistory(inferrer.getHistory(agentId));
    }
  }, [agentId, inferrer]);

  const clearHistory = useCallback(() => {
    inferrer.clearHistory(agentId);
    setHistory([]);
    setVisualState(null);
  }, [agentId, inferrer]);

  return {
    visualState,
    history,
    updateState,
    clearHistory,
    isReady,
  };
}

export default useVisualState;
