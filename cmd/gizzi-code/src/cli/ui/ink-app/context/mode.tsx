/**
 * Mode Context - Global mode state management
 * 
 * Provides:
 * - Current mode (code | cowork)
 * - Mode switching
 * - Mode persistence via KV store
 * - Mode-aware utilities
 */

import { createContext, useContext, createMemo, createEffect, createSignal, onMount } from "solid-js"
import { createSimpleContext } from "@/cli/ui/ink-app/context/helper"
import { useKV } from "@/cli/ui/ink-app/context/kv"
import type { AppMode } from "@/cli/ui/ink-app/component/mode-switcher"

const MODE_STORAGE_KEY = "gizzi-mode"

interface ModeContextValue {
  mode: AppMode
  setMode: (mode: AppMode) => void
  isCode: boolean
  isCowork: boolean
  toggle: () => void
}

// Create context with default values
const ModeContext = createContext<ModeContextValue>({
  mode: "code",
  setMode: () => {},
  isCode: true,
  isCowork: false,
  toggle: () => {},
})

// Provider component
export function ModeProvider(props: { children: any }) {
  const kv = useKV()
  
  // Initialize mode from KV store
  const [mode, setModeState] = createSignal<AppMode>("code")
  
  // Load saved mode on mount
  onMount(() => {
    if (kv.ready) {
      const saved = kv.get(MODE_STORAGE_KEY, "code") as AppMode
      if (saved && ["code", "cowork"].includes(saved)) {
        setModeState(saved)
      }
    }
  })
  
  // Save mode when it changes AND persist to KV
  createEffect(() => {
    const currentMode = mode()
    console.log("[ModeContext] Mode changed to:", currentMode)
    if (kv.ready) {
      console.log("[ModeContext] Saving to KV store")
      kv.set(MODE_STORAGE_KEY, currentMode)
    }
  })

  const value = createMemo<ModeContextValue>(() => ({
    mode: mode(),
    setMode: (newMode: AppMode) => {
      console.log("[ModeContext] setMode called with:", newMode)
      setModeState(newMode)
    },
    isCode: mode() === "code",
    isCowork: mode() === "cowork",
    toggle: () => {
      const newMode = mode() === "code" ? "cowork" : "code"
      console.log("[ModeContext] toggle called, new mode:", newMode)
      setModeState(newMode)
    },
  }))
  
  return (
    <ModeContext.Provider value={value()}>
      {props.children}
    </ModeContext.Provider>
  )
}

// Hook for consuming mode context
export function useMode() {
  const context = useContext(ModeContext)
  if (!context) {
    throw new Error("useMode must be used within ModeProvider")
  }
  return context
}

// HOC for mode-aware components
export function withMode<P extends object>(
  Component: (props: P & { mode: AppMode }) => any
) {
  return function WithMode(props: P) {
    const mode = useMode()
    return <Component {...props} mode={mode.mode} />
  }
}
