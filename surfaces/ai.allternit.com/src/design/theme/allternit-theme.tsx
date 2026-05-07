/**
 * Allternit Theme System
 * 
 * Ported from terminal app theme.ts
 * Provides centralized theming for status, runtime, and UI elements
 */

import { useContext, createContext } from "react"

export type AllternitRuntimeState = 
  | "idle"
  | "connecting" 
  | "hydrating"
  | "planning"
  | "web"
  | "executing"
  | "responding"
  | "compacting"

export interface AllternitTheme {
  /** Foreground colors */
  fg: string
  bg: string
  muted: string
  accent: string
  
  /** Status colors */
  status: Record<AllternitRuntimeState, string>
  
  /** Glyphs/symbols */
  glyph: {
    status: string
    tool: string
    separator: string
  }
}

/** Default dark theme (matches terminal) */
export const defaultTheme: AllternitTheme = {
  fg: "#e0e0e0",
  bg: "#0f0f0f",
  muted: "#666666",
  accent: "#3b82f6",
  
  status: {
    idle: "#666666",
    connecting: "#f59e0b",
    hydrating: "#3b82f6",
    planning: "#8b5cf6",
    web: "#10b981",
    executing: "#f59e0b",
    responding: "#3b82f6",
    compacting: "#8b5cf6",
  },
  
  glyph: {
    status: "◉",
    tool: "⚡",
    separator: "•",
  },
}

/** Light theme variant */
export const lightTheme: AllternitTheme = {
  fg: "#1a1a1a",
  bg: "#ffffff",
  muted: "#888888",
  accent: "#2563eb",
  
  status: {
    idle: "#888888",
    connecting: "#d97706",
    hydrating: "#2563eb",
    planning: "#7c3aed",
    web: "#059669",
    executing: "#d97706",
    responding: "#2563eb",
    compacting: "#7c3aed",
  },
  
  glyph: {
    status: "◉",
    tool: "⚡",
    separator: "•",
  },
}

/** Get color for runtime state */
export function getStatusColor(state: AllternitRuntimeState, theme: AllternitTheme = defaultTheme): string {
  return theme.status[state] || theme.status.idle
}

/** Theme context */
export const ThemeContext = createContext<AllternitTheme>(defaultTheme)

/** Theme hook for React components */
export function useAllternitTheme(): AllternitTheme {
  return useContext(ThemeContext)
}

/** Theme provider */
export function AllternitThemeProvider({ 
  children, 
  theme = defaultTheme 
}: { 
  children: React.ReactNode
  theme?: AllternitTheme 
}) {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  )
}
