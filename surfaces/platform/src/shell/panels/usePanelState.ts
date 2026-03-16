/**
 * usePanelState hook
 * 
 * Manages panel size and collapsed state persistence.
 * 
 * @module @a2r/platform/shell/panels
 */

import { useState, useCallback } from 'react';

interface PanelState {
  size: number;
  collapsed: boolean;
}

const STORAGE_KEY = 'a2r_panel_states';

function getStoredStates(): Record<string, PanelState> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function setStoredStates(states: Record<string, PanelState>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  } catch {
    // Ignore storage errors
  }
}

export function usePanelState() {
  const [states, setStates] = useState<Record<string, PanelState>>(getStoredStates);

  const getPanelSize = useCallback((panelId: string): number | undefined => {
    return states[panelId]?.size;
  }, [states]);

  const setPanelSize = useCallback((panelId: string, size: number) => {
    setStates(prev => {
      const updated = {
        ...prev,
        [panelId]: { ...prev[panelId], size }
      };
      setStoredStates(updated);
      return updated;
    });
  }, []);

  const isPanelCollapsed = useCallback((panelId: string): boolean | undefined => {
    return states[panelId]?.collapsed;
  }, [states]);

  const setPanelCollapsed = useCallback((panelId: string, collapsed: boolean) => {
    setStates(prev => {
      const updated = {
        ...prev,
        [panelId]: { ...prev[panelId], collapsed }
      };
      setStoredStates(updated);
      return updated;
    });
  }, []);

  return {
    getPanelSize,
    setPanelSize,
    isPanelCollapsed,
    setPanelCollapsed,
  };
}

export default usePanelState;
