/**
 * Agent Toggle - ON/OFF switch for agent mode
 * 
 * Placement: Top right corner (next to mode switcher)
 * Works in: Both Code and Cowork modes
 * 
 * When ON: Agent is mounted and active
 * When OFF: Standard terminal without agent
 */

import { createSignal, Show } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { RGBA, TextAttributes } from "@opentui/core"

export interface AgentToggleProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  size?: "small" | "medium"
}

export function AgentToggle(props: AgentToggleProps) {
  const { theme } = useTheme()
  const [hovered, setHovered] = createSignal(false)
  
  const accentColor = RGBA.fromInts(167, 139, 250) // Purple accent
  const enabledColor = RGBA.fromInts(134, 239, 172) // Green when on
  const disabledColor = RGBA.fromInts(107, 117, 125) // Gray when off
  
  const currentColor = () => props.enabled ? enabledColor : disabledColor
  
  return (
    <box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseUp={(event) => {
        if (event.button === 0) { // Left click only
          props.onToggle(!props.enabled)
        }
      }}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      backgroundColor={props.enabled ? RGBA.fromInts(134, 239, 172, 38) : "transparent"}
      borderStyle="single"
      borderColor={currentColor()}
      borderRadius={999}
      cursor="pointer"
    >
      <box flexDirection="row" gap={1} alignItems="center">
        {/* Status dot */}
        <box
          width={1}
          height={1}
          backgroundColor={currentColor()}
          borderRadius={999}
        />
        
        {/* Label */}
        <text 
          fg={props.enabled ? enabledColor : (hovered() ? accentColor : theme.textMuted)}
          attributes={props.enabled ? TextAttributes.BOLD : undefined}
          style={{ fontSize: props.size === "small" ? 0.8 : 1 }}
        >
          {props.enabled ? "AGENT ON" : "AGENT OFF"}
        </text>
      </box>
    </box>
  )
}

// Agent Toggle with auto-tooltip
export function AgentToggleWithTooltip(props: AgentToggleProps) {
  const { theme } = useTheme()
  const [showTooltip, setShowTooltip] = createSignal(false)
  
  return (
    <box 
      flexDirection="column" 
      gap={0}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <AgentToggle {...props} />
      
      <Show when={showTooltip()}>
        <box
          backgroundColor={RGBA.fromInts(0, 0, 0, 128)}
          padding={1}
          borderRadius={2}
          marginTop={1}
        >
          <text fg={theme.text} style={{ fontSize: 0.7 }} wrap="wrap">
            {props.enabled 
              ? "Agent is active and monitoring. Press A or click to disable."
              : "Agent is disabled. Press A or click to enable agent assistance."}
          </text>
        </box>
      </Show>
    </box>
  )
}

// Re-export useAgent from context for convenience
export { useAgent } from "@/cli/ui/tui/context/agent"
export { AgentProvider } from "@/cli/ui/tui/context/agent"
