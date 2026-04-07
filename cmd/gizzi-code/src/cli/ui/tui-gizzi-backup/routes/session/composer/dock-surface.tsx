/**
 * dock-surface.tsx — shared dock surface primitives for the session composer.
 *
 * DockShell   — bordered panel with configurable accent color
 * DockTray    — responsive action bar at the bottom of a dock
 *
 * Both patterns repeat across question, permission, and reject docks.
 */

import type { JSX } from "solid-js"
import type { RGBA } from "@opentui/core"
import { SplitBorder } from "@/cli/ui/tui/component/border"
import { useTheme } from "@/cli/ui/tui/context/theme"

// ---------------------------------------------------------------------------
// DockShell
// ---------------------------------------------------------------------------

interface DockShellProps {
  /** Accent color for the left border. */
  color: RGBA
  children: JSX.Element
  // Optional layout overrides forwarded to the box (e.g. fullscreen expand).
  top?: number
  bottom?: number
  left?: number
  right?: number
  maxHeight?: number
  position?: string
}

/**
 * The common bordered-panel wrapper used by all session dock surfaces.
 *
 * Renders a box with:
 *   - backgroundPanel fill
 *   - left border in the supplied accent color
 *   - SplitBorder custom border characters
 */
export function DockShell(props: DockShellProps) {
  const { theme } = useTheme()
  const layoutProps = () => {
    const p: Record<string, unknown> = {}
    if (props.top !== undefined) p.top = props.top
    if (props.bottom !== undefined) p.bottom = props.bottom
    if (props.left !== undefined) p.left = props.left
    if (props.right !== undefined) p.right = props.right
    if (props.maxHeight !== undefined) p.maxHeight = props.maxHeight
    if (props.position !== undefined) p.position = props.position
    return p
  }

  return (
    <box
      backgroundColor={theme.backgroundPanel}
      border={["left"]}
      borderColor={props.color}
      customBorderChars={SplitBorder.customBorderChars}
      {...layoutProps()}
    >
      {props.children}
    </box>
  )
}

// ---------------------------------------------------------------------------
// DockTray
// ---------------------------------------------------------------------------

interface DockTrayProps {
  /** When true, stacks content vertically for narrow terminals. */
  narrow: boolean
  children: JSX.Element
}

/**
 * The common action bar rendered at the bottom of dock surfaces.
 *
 * Adapts its flex direction and alignment to narrow terminals.
 * Fills with backgroundElement to visually separate from the body.
 */
export function DockTray(props: DockTrayProps) {
  const { theme } = useTheme()

  return (
    <box
      flexDirection={props.narrow ? "column" : "row"}
      flexShrink={0}
      gap={1}
      paddingTop={1}
      paddingLeft={2}
      paddingRight={3}
      paddingBottom={1}
      backgroundColor={theme.backgroundElement}
      justifyContent={props.narrow ? "flex-start" : "space-between"}
      alignItems={props.narrow ? "flex-start" : "center"}
    >
      {props.children}
    </box>
  )
}
