/**
 * App State Types
 */

import { useState, useCallback } from 'react'

export interface AppState {
  sessionId?: string
  userId?: string
  isInteractive: boolean
  theme?: string
  notifications?: boolean
}

export const defaultAppState: AppState = {
  isInteractive: true,
}

// Global state store (singleton)
let globalAppState: AppState = { ...defaultAppState }
const listeners = new Set<(state: AppState) => void>()

export function getAppState(): AppState {
  return { ...globalAppState }
}

export function setAppState(updates: Partial<AppState>): void {
  globalAppState = { ...globalAppState, ...updates }
  listeners.forEach(listener => listener(globalAppState))
}

export function subscribeToAppState(listener: (state: AppState) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// React hooks
export function useAppState(): AppState {
  const [state, setState] = useState(globalAppState)
  
  // Subscribe to changes
  useState(() => {
    const unsubscribe = subscribeToAppState(setState)
    return unsubscribe
  })
  
  return state
}

export function useSetAppState(): (updates: Partial<AppState>) => void {
  return useCallback((updates: Partial<AppState>) => {
    setAppState(updates)
  }, [])
}

// Alias for compatibility
export const useAppStateStore = useAppState
