import { For, createMemo } from "solid-js"
import { RGBA } from "@opentui/core"
import { useMascotFrame } from "@/cli/ui/components/animation"
import { useGIZZITheme } from "@/cli/ui/components/gizzi/theme"
import { useTheme } from "@/cli/ui/ink-app/context/theme"

export type GIZZIMascotState =
  | "idle"
  | "thinking"
  | "executing"
  | "responding"
  | "alert"
  | "curious"
  | "focused"
  | "steady"
  | "pleased"
  | "skeptical"
  | "mischief"
  | "proud"
  | "dizzy"
  | "startled"
  | "locked-on"

export function GIZZIMascot(props: {
  state: GIZZIMascotState
  color?: RGBA
  compact?: boolean
}) {
  const tone = useGIZZITheme()
  const { theme } = useTheme()
  const color = createMemo(() => props.color ?? tone().accent)
  const shellColor = createMemo(() => RGBA.fromInts(212, 176, 140))
  const eyeColor = createMemo(() => (props.compact ? theme.text : RGBA.fromInts(217, 119, 87)))
  const coreColor = createMemo(() => (props.compact ? tone().accent : RGBA.fromInts(217, 119, 87)))

  const frame = useMascotFrame(() => props.state, () => !!props.compact)
  const lines = createMemo(() => frame().split("\n"))

  const eyeTokens = ["  ●    ●  ", "  -    -  ", "  ?    ?  ", "  !    !  ", "  ^    ^  ", "  ●    ●  ", "  ◉    ◉  ", "  X    X  ", "  ●    ●  ", "  o    O  ", "  O    o  ", " ●    ●   ", "   ●    ● ", "▀▀", "??", "!!", "^^", "oO", "●●", "◉◉", "XX", "▀ ", " ▀"] as const
  const mouthTokens = ["  A : / / ", "  A : --- ", "  A : ▭▭▭ ", "  A : ◡◡◡ ", "  A : ﹏﹏ ", "  A : --- ", "▄▄", "▀▀", "◡◡", "▭ ", "﹏ "] as const

  function renderLine(line: string, index: number) {
    // Colors
    const obsidian = RGBA.fromInts(17, 19, 24)
    const sand = RGBA.fromInts(212, 176, 140)
    const structuralSand = RGBA.fromInts(143, 111, 86)
    // GIZZI accent: teal/cyan from gizzi theme darkCyan (#56B6C2) — NOT coral
    const gizziAccent = RGBA.fromInts(86, 182, 194)

    const isCompact = !!props.compact

    // --- FULL VERSION LOGIC (8 lines) ---
    if (!isCompact) {
      // 1. Floating Beacon Detection (Line 0)
      if (index === 0 && line.includes("▄▄")) {
        const parts = line.split("▄▄")
        return (
          <text fg={gizziAccent}>
            <span>{parts[0] ?? ""}</span>
            <span style={{ bold: true }}>▄▄</span>
            <span>{parts[1] ?? ""}</span>
          </text>
        )
      }

      // 2. Antenna Blocks (Line 1)
      if (index === 1 && line.includes("▄▄▄")) {
        const parts = line.split("▄▄▄")
        return (
          <text fg={sand}>
            <span>{parts[0] ?? ""}</span>
            <span style={{ bold: true }}>▄▄▄</span>
            <span>{parts[1] ?? ""}</span>
            <span style={{ bold: true }}>▄▄▄</span>
            <span>{parts[2] ?? ""}</span>
          </text>
        )
      }

      // 3. Eye/Panel Detection (Line 3)
      const eyeToken = eyeTokens.find((t) => line.includes(t))
      if (index === 3 && eyeToken) {
        const parts = line.split(eyeToken)
        return (
          <text fg={sand}>
            <span>{parts[0] ?? ""}</span>
            <span style={{ bg: obsidian, fg: gizziAccent, bold: true }}>{eyeToken}</span>
            <span>{parts[1] ?? ""}</span>
          </text>
        )
      }

      // 4. Mark/Panel Detection (Line 4)
      const mouthToken = mouthTokens.find((t) => line.includes(t))
      if (index === 4 && mouthToken) {
        const parts = line.split(mouthToken)
        return (
          <text fg={sand}>
            <span>{parts[0] ?? ""}</span>
            <span style={{ bg: obsidian, fg: gizziAccent, bold: true }}>{mouthToken}</span>
            <span>{parts[1] ?? ""}</span>
          </text>
        )
      }

      // 5. Head Bottom (Line 5)
      if (index === 5) {
        return <text fg={sand}>{line}</text>
      }

      // 6. Base/Legs (Line 6-7)
      if (index === 6 || index === 7) {
        return <text fg={structuralSand}>{line}</text>
      }
    }

    // --- COMPACT VERSION LOGIC (5 lines) ---
    if (isCompact) {
      // 1. Beacon (Line 0)
      if (index === 0 && line.includes("▄▄")) {
        return (
          <text fg={gizziAccent}>
            <span style={{ bold: true }}>{line}</span>
          </text>
        )
      }

      // 2. Eye Panel (Line 2)
      const eyeToken = eyeTokens.find((t) => line.includes(t))
      if (index === 2 && eyeToken) {
        const parts = line.split(eyeToken)
        return (
          <text fg={shellColor()}>
            <span>{parts[0] ?? ""}</span>
            <span style={{ fg: gizziAccent, bold: true }}>{eyeToken}</span>
            <span>{parts[1] ?? ""}</span>
          </text>
        )
      }

      // 3. Mouth Panel (Line 3)
      const mouthToken = mouthTokens.find((t) => line.includes(t))
      if (index === 3 && mouthToken) {
        const parts = line.split(mouthToken)
        return (
          <text fg={shellColor()}>
            <span>{parts[0] ?? ""}</span>
            <span style={{ fg: gizziAccent, bold: true }}>{mouthToken}</span>
            <span>{parts[1] ?? ""}</span>
          </text>
        )
      }
    }

    // Default Shell (Sand)
    return <text fg={shellColor()}>{line}</text>
  }

  return (
    <box flexDirection="column" flexShrink={0}>
      <For each={lines()}>{(line, index) => renderLine(line, index())}</For>
    </box>
  )
}
