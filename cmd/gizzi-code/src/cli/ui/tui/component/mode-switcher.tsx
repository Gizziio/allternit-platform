/**
 * Mode Switcher - Pill variant for TUI
 * Based on allternit-platform ModeSwitcher.tsx
 * 
 * Placement: Top right corner (during onboarding and main screen)
 * Modes: Code | Cowork
 * 
 * Features:
 * - Clickable (mouse support)
 * - Keyboard shortcuts (optional)
 * - Persists selection via KV store
 * - Visual distinction between modes
 */

import { createSignal, createMemo, onMount, Show, createEffect } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useKV } from "@/cli/ui/tui/context/kv"
import { RGBA, TextAttributes } from "@opentui/core"

export type AppMode = "code" | "cowork"

const MODE_STORAGE_KEY = "gizzi-mode"

interface ModeConfig {
  id: AppMode
  label: string
  icon: string
  accentColor: RGBA
  accentLight: RGBA
  description: string
}

const MODES: ModeConfig[] = [
  {
    id: "code",
    label: "Code",
    icon: "💻",
    accentColor: RGBA.fromInts(107, 154, 123), // Green (#6B9A7B)
    accentLight: RGBA.fromInts(107, 154, 123, 38), // 15% opacity
    description: "Development environment with code tools",
  },
  {
    id: "cowork",
    label: "Cowork",
    icon: "🤝",
    accentColor: RGBA.fromInts(154, 123, 170), // Purple (#9A7BAA)
    accentLight: RGBA.fromInts(154, 123, 170, 38), // 15% opacity
    description: "Collaborative workspace with artifacts",
  },
]

interface ModeSwitcherProps {
  activeMode: AppMode
  onModeChange: (mode: AppMode) => void
  size?: "small" | "medium" | "large"
  showLabels?: boolean
  showTooltips?: boolean
}

export function ModeSwitcher(props: ModeSwitcherProps) {
  const { theme } = useTheme()
  const kv = useKV()
  const [hoveredMode, setHoveredMode] = createSignal<AppMode | null>(null)
  const [clickedMode, setClickedMode] = createSignal<AppMode | null>(null)

  const sizeConfig = {
    small: {
      height: 3,
      paddingX: 2,
      fontSize: 1,
    },
    medium: {
      height: 4,
      paddingX: 3,
      fontSize: 1,
    },
    large: {
      height: 5,
      paddingX: 4,
      fontSize: 1,
    },
  }

  const sizes = sizeConfig[props.size || "medium"]
  const activeConfig = MODES.find((m) => m.id === props.activeMode) || MODES[0]

  // Clear clicked state after animation
  createEffect(() => {
    if (clickedMode()) {
      const timer = setTimeout(() => setClickedMode(null), 200)
      return () => clearTimeout(timer)
    }
  })

  return (
    <box
      flexDirection="row"
      gap={1}
      padding={1}
      borderStyle={clickedMode() ? "double" : "single"}
      borderColor={clickedMode() ? RGBA.fromInts(255, 255, 255) : theme.border}
      backgroundColor={RGBA.fromInts(0, 0, 0, 64)}
    >
      {MODES.map((mode) => {
        const isActive = props.activeMode === mode.id
        const isHovered = hoveredMode() === mode.id
        const isClicked = clickedMode() === mode.id

        return (
          <box
            onMouseUp={(event) => {
              if (event.button === 0) {
                setClickedMode(mode.id)
                props.onModeChange(mode.id)
              }
            }}
            paddingLeft={sizes.paddingX}
            paddingRight={sizes.paddingX}
            paddingTop={1}
            paddingBottom={1}
            backgroundColor={isActive ? mode.accentColor : (isClicked ? RGBA.fromInts(255, 255, 255, 100) : "transparent")}
          >
            <box flexDirection="row" gap={1} alignItems="center">
              <text fg={isActive ? RGBA.fromInts(255, 255, 255) : (isHovered || isClicked ? mode.accentColor : theme.textMuted)}>
                {mode.icon}
              </text>
              <Show when={props.showLabels !== false}>
                <text
                  fg={isActive ? RGBA.fromInts(255, 255, 255) : (isHovered || isClicked ? mode.accentColor : theme.text)}
                  attributes={isActive ? TextAttributes.BOLD : undefined}
                >
                  {mode.label}
                </text>
              </Show>
              {/* Active indicator dot */}
              <Show when={isActive}>
                <box width={1} height={1} backgroundColor={RGBA.fromInts(255, 255, 255)} marginLeft={1} />
              </Show>
            </box>
          </box>
        )
      })}
    </box>
  )
}

// Mode indicator badge (for status bar, etc.)
interface ModeIndicatorProps {
  mode: AppMode
  size?: "small" | "medium"
  pulse?: boolean
}

export function ModeIndicator(props: ModeIndicatorProps) {
  const { theme } = useTheme()
  const config = MODES.find((m) => m.id === props.mode) || MODES[0]
  
  return (
    <box flexDirection="row" gap={1} alignItems="center">
      <box
        width={props.size === "small" ? 1 : 2}
        height={props.size === "small" ? 1 : 2}
        backgroundColor={config.accentColor}
      />
      <text fg={config.accentColor}>
        {config.label}
      </text>
      <Show when={props.pulse}>
        <text fg={config.accentColor}>●</text>
      </Show>
    </box>
  )
}

// Helper hook for mode persistence with KV store
export function useModePersistence() {
  const kv = useKV()
  const [mode, setModeState] = createSignal<AppMode>("code")
  
  // Load mode from KV store
  const loadMode = () => {
    if (!kv.ready) return "code"
    const saved = kv.get(MODE_STORAGE_KEY, "code") as AppMode
    if (saved && ["code", "cowork"].includes(saved)) {
      setModeState(saved)
      return saved
    }
    return "code"
  }
  
  // Save mode to KV store
  const saveMode = (newMode: AppMode) => {
    setModeState(newMode)
    kv.set(MODE_STORAGE_KEY, newMode)
  }
  
  return {
    mode: mode(),
    setMode: saveMode,
    loadMode,
  }
}

// Re-export useMode from context for convenience
export { useMode } from "@/cli/ui/tui/context/mode"
export { ModeProvider } from "@/cli/ui/tui/context/mode"

// Re-export AgentToggle for convenience
export { AgentToggle } from "./agent-toggle"
export { useAgent } from "@/cli/ui/tui/context/agent"
export { AgentProvider } from "@/cli/ui/tui/context/agent"

// No keyboard shortcuts - mode switching is mouse-only to avoid conflicts
