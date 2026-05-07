import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AppMode } from '../shell/ShellHeader';

const MODE_STORAGE_KEY = 'allternit-platform-mode';

interface ModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isLoaded: boolean;
}

const ModeContext = createContext<ModeContextType | null>(null);

export function ModeProvider({ 
  children, 
  defaultMode = 'chat',
  onModeChange 
}: { 
  children: React.ReactNode;
  defaultMode?: AppMode;
  onModeChange?: (mode: AppMode) => void;
}) {
  const [mode, setModeState] = useState<AppMode>(defaultMode);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load mode from localStorage on mount
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem(MODE_STORAGE_KEY) as AppMode | null;
      if (savedMode && ['chat', 'cowork', 'code', 'design', 'browser'].includes(savedMode)) {
        setModeState(savedMode);
        onModeChange?.(savedMode);
      }
    } catch {
      // localStorage not available
    }
    setIsLoaded(true);
  }, [onModeChange]);

  const setMode = useCallback((newMode: AppMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, newMode);
    } catch {
      // localStorage not available
    }
    onModeChange?.(newMode);
  }, [onModeChange]);

  return (
    <ModeContext.Provider value={{ mode, setMode, isLoaded }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
}

export function useModeValue(): AppMode {
  const context = useContext(ModeContext);
  return context?.mode ?? 'chat';
}
