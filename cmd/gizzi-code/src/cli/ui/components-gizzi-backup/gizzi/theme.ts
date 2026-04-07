import type { RGBA } from "@opentui/core"
import { createMemo } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"

export type GIZZIRuntimeState =
  | "idle"
  | "connecting"
  | "hydrating"
  | "planning"
  | "web"
  | "executing"
  | "responding"
  | "compacting"

export const GIZZI_GLYPHS = {
  status: "❯",
  prompt: "❯",
  separator: "▕",
  tool: "⧉",
  dag: "≫",
} as const

type Palette = Record<GIZZIRuntimeState, RGBA>

export function useGIZZITheme() {
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
      glyph: GIZZI_GLYPHS,
      space: {
        xs: 0,
        sm: 1,
        md: 2,
        lg: 3,
      },
    }
  })
}
