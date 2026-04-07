/**
 * AppState Store
 * Centralized state management with React hooks
 */

import { useState, useEffect, useCallback } from 'react'

export interface AppState {
  sessionId?: string
  userId?: string
  isInteractive: boolean
  theme?: string
  notifications?: boolean
  isLoading?: boolean
  error?: string | null
}

export const defaultAppState: AppState = {
  isInteractive: true,
  theme: 'dark',
  notifications: true,
  isLoading: false,
  error: null,
}

type StateListener = (state: AppState) => void

class AppStateStoreClass {
  private state: AppState = { ...defaultAppState }
  private listeners = new Set<StateListener>()

  getState(): AppState {
    return { ...this.state }
  }

  setState(updates: Partial<AppState>): void {
    this.state = { ...this.state, ...updates }
    this.notifyListeners()
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners(): void {
    const currentState = this.getState()
    this.listeners.forEach(listener => listener(currentState))
  }

  reset(): void {
    this.state = { ...defaultAppState }
    this.notifyListeners()
  }
}

export const AppStateStore = new AppStateStoreClass()

export function useAppStateStore(): [AppState, (updates: Partial<AppState>) => void] {
  const [state, setState] = useState<AppState>(AppStateStore.getState())

  useEffect(() => {
    return AppStateStore.subscribe(setState)
  }, [])

  const setAppState = useCallback((updates: Partial<AppState>) => {
    AppStateStore.setState(updates)
  }, [])

  return [state, setAppState]
}

export function useAppStateValue<T>(selector: (state: AppState) => T): T {
  const [value, setValue] = useState<T>(() => selector(AppStateStore.getState()))

  useEffect(() => {
    return AppStateStore.subscribe(state => {
      setValue(selector(state))
    })
  }, [selector])

  return value
}

export function useSetAppState(): (updates: Partial<AppState>) => void {
  return useCallback((updates: Partial<AppState>) => {
    AppStateStore.setState(updates)
  }, [])
}

export function getAppState(): AppState {
  return AppStateStore.getState()
}

export function setAppState(updates: Partial<AppState>): void {
  AppStateStore.setState(updates)
}

export function resetAppState(): void {
  AppStateStore.reset()
}

export default {
  AppStateStore,
  useAppStateStore,
  useAppStateValue,
  useSetAppState,
  getAppState,
  setAppState,
  resetAppState,
  defaultAppState,
}
