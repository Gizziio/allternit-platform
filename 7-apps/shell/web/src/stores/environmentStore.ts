/**
 * Environment Store
 * 
 * Zustand store for managing N5 Environment configuration.
 * Persists to localStorage and provides global access.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  EnvironmentConfig, 
  EnvironmentSpecResponse, 
  getDefaultEnvironmentConfig 
} from '../services/runtimeService';

interface EnvironmentState {
  // Current environment configuration
  environment: EnvironmentConfig;
  
  // Loading states
  isResolving: boolean;
  error: string | null;
  
  // Actions
  setEnvironment: (env: EnvironmentConfig) => void;
  setEnvironmentUri: (uri: string) => void;
  setEnvironmentSource: (source: EnvironmentConfig['source']) => void;
  setResolved: (resolved: EnvironmentSpecResponse | undefined) => void;
  setResolving: (resolving: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useEnvironmentStore = create<EnvironmentState>()(
  persist(
    (set) => ({
      // Initial state
      environment: getDefaultEnvironmentConfig(),
      isResolving: false,
      error: null,

      // Actions
      setEnvironment: (env) => set({ environment: env }),
      
      setEnvironmentUri: (uri) => set((state: EnvironmentState) => ({
        environment: { ...state.environment, uri, resolved: undefined },
        error: null,
      })),
      
      setEnvironmentSource: (source) => set((state: EnvironmentState) => ({
        environment: { ...state.environment, source, resolved: undefined },
        error: null,
      })),
      
      setResolved: (resolved) => set((state: EnvironmentState) => ({
        environment: { ...state.environment, resolved },
        isResolving: false,
        error: null,
      })),
      
      setResolving: (resolving) => set({ isResolving: resolving }),
      
      setError: (error) => set({ error, isResolving: false }),
      
      reset: () => set({
        environment: getDefaultEnvironmentConfig(),
        isResolving: false,
        error: null,
      }),
    }),
    {
      name: 'a2r-environment-storage',
      partialize: (state: EnvironmentState) => ({ 
        environment: {
          source: state.environment.source,
          uri: state.environment.uri,
          // Don't persist resolved spec, re-resolve on load
        }
      }),
    }
  )
);

// Selector hooks for convenience
export const useEnvironment = () => useEnvironmentStore((state: EnvironmentState) => state.environment);
export const useEnvironmentResolved = () => useEnvironmentStore((state: EnvironmentState) => state.environment.resolved);
export const useEnvironmentResolving = () => useEnvironmentStore((state: EnvironmentState) => state.isResolving);
export const useEnvironmentError = () => useEnvironmentStore((state: EnvironmentState) => state.error);
