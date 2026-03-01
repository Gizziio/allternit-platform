import type { RGBA } from "@opentui/core"
import { createMemo } from "solid-js"
import { useTheme } from "@/cli/cmd/tui/context/theme"

export type A2RRuntimeState =
  | "idle"
  | "connecting"
  | "hydrating"
  | "planning"
  | "web"
  | "executing"
  | "responding"
  | "compacting"

export const A2R_GLYPHS = {
  status: ">",
  prompt: ">",
  separator: "|",
  tool: "[]",
  dag: "->",
} as const

type Palette = Record<A2RRuntimeState, RGBA>

export function useA2RTheme() {
  const { theme } = useTheme()
  return createMemo(() => {
    const status: Palette = {
      idle: theme.textMuted,
      connecting: theme.info,
      hydrating: theme.secondary,
      planning: theme.warning,
      web: theme.primary,
      executing: theme.primary,
      responding: theme.accent,
      compacting: theme.success,
    }

    return {
      bg: theme.background,
      fg: theme.text,
      muted: theme.textMuted,
      accent: theme.accent,
      danger: theme.error,
      ok: theme.success,
      warn: theme.warning,
      panel: theme.backgroundPanel,
      element: theme.backgroundElement,
      border: theme.border,
      status,
      glyph: A2R_GLYPHS,
      space: {
        xs: 0,
        sm: 1,
        md: 2,
        lg: 3,
      },
    }
  })
}
