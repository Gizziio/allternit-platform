/**
 * Cowork Viewer Indicator
 * 
 * Shows connected clients in the Cowork session.
 */

import { Show, For } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useCollaborationStatus } from "@/cli/ui/tui/context/cowork-collaboration"
import { TextAttributes } from "@opentui/core"

interface ViewerIndicatorProps {
  compact?: boolean
}

export function CoworkViewerIndicator(props: ViewerIndicatorProps) {
  const { theme } = useTheme()
  const { isConnected, viewerCount, viewers } = useCollaborationStatus()
  
  return (
    <Show when={isConnected()}>
      <box flexDirection="row" gap={1} alignItems="center">
        <Show when={!props.compact}>
          <text fg={theme.textMuted}>Viewers:</text>
        </Show>
        
        {/* Self indicator */}
        <text fg={theme.success}>●</text>
        
        {/* Other viewers */}
        <For each={viewers()}>
          {(viewer) => (
            <text 
              fg={viewer.isActive ? theme.info : theme.textMuted}
              attributes={viewer.isActive ? TextAttributes.BOLD : undefined}
            >
              ●
            </text>
          )}
        </For>
        
        <Show when={viewerCount() > 1}>
          <text fg={theme.textMuted}>({viewerCount()})</text>
        </Show>
      </box>
    </Show>
  )
}

export function CoworkConnectionBadge() {
  const { theme } = useTheme()
  const { isConnected } = useCollaborationStatus()
  
  return (
    <box flexDirection="row" gap={1} alignItems="center">
      <text fg={isConnected() ? theme.success : theme.error}>
        {isConnected() ? "●" : "○"}
      </text>
      <text fg={theme.textMuted}>
        {isConnected() ? "Connected" : "Offline"}
      </text>
    </box>
  )
}
