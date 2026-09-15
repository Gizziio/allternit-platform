import { For, createSignal, onMount, onCleanup, Show, Switch, Match, createMemo } from "solid-js"
import { RGBA, TextAttributes } from "@opentui/core"

// Boot animation phases
type BootPhase = "cli" | "transition" | "matrix" | "tower" | "logo" | "splash"

// Matrix Logo - The "A" construct from BRAND.md
const MATRIX_LOGO = [
  "  █  ",
  " █ █ ",
  "██ ██",
  "█ █ █",
  "█   █",
]

// Official GIZZI Mascot - Vacuum Tube style from registry.ts
const GIZZI_MASCOT = [
  "      ▄▄      ", // 0: Floating Beacon
  "   ▄▄▄  ▄▄▄   ", // 1: Antenna Blocks
  " ▄██████████▄ ", // 2: Head Top
  " █  ●    ●  █ ", // 3: Eye Panel
  " █  A : / / █ ", // 4: Mouth Panel
  "  ▀████████▀  ", // 5: Head Bottom
  "   █ █  █ █   ", // 6: 4 Legs
  "   ▀ ▀  ▀ ▀   ", // 7: Feet
]

// System check lines
const SYSTEM_CHECKS = [
  { label: "node", value: "v22.14.0" },
  { label: "platform", value: "darwin" },
  { label: "arch", value: "arm64" },
  { label: "kernel", value: "ready" },
  { label: "memory", value: "ok" },
]

// GIZZI Logo Text (Blocky version)
const GIZZI_LOGO = [
  " ▄████▄  ▄█  ██████  ██████  ▄█  ▄█  ▄████▄ ",
  " ██  ▀▀  ██     ▄█▀     ▄█▀  ██  ██  ██  ██ ",
  " ██  ▄▄  ██   ▄█▀     ▄█▀    ██  ██  ██  ██ ",
  " ▀████▀  ▀█  ██████  ██████  ▀█  ▀█  ▀████▀ ",
]

const GIZZI_CODE_TEXT = "GIZZI CODE"

export function ShimmeringBanner() {
  const [phase, setPhase] = createSignal<BootPhase>("cli")
  const [tick, setTick] = createSignal(0)
  const [typedText, setTypedText] = createSignal("")
  const [checkIndex, setCheckIndex] = createSignal(0)
  const [completedChecks, setCompletedChecks] = createSignal<string[]>([])

  let timer: ReturnType<typeof setInterval>
  let typeTimer: ReturnType<typeof setInterval>
  let checkTimer: ReturnType<typeof setInterval>

  onMount(() => {
    // Shimmer timer - 30fps
    timer = setInterval(() => {
      setTick(t => t + 1)
    }, 33)

    // CLI phase: Steady system checks (1.5s)
    let checkIdx = 0
    checkTimer = setInterval(() => {
      if (checkIdx < SYSTEM_CHECKS.length) {
        setCompletedChecks(prev => [...prev, `${SYSTEM_CHECKS[checkIdx].label}: ${SYSTEM_CHECKS[checkIdx].value}`])
        setCheckIndex(checkIdx + 1)
        checkIdx++
      }
    }, 300)

    // Phase transitions (Total 7s)
    setTimeout(() => setPhase("transition"), 1500)
    setTimeout(() => setPhase("matrix"), 1800)
    setTimeout(() => setPhase("tower"), 2800)
    setTimeout(() => {
      setPhase("logo")
      setTypedText("")
      let i = 0
      typeTimer = setInterval(() => {
        if (i < GIZZI_CODE_TEXT.length) {
          setTypedText(GIZZI_CODE_TEXT.slice(0, i + 1))
          i++
        } else {
          clearInterval(typeTimer)
        }
      }, 80)
    }, 3800)
    setTimeout(() => setPhase("splash"), 5000)
  })

  onCleanup(() => {
    clearInterval(timer)
    if (typeTimer) clearInterval(typeTimer)
    clearInterval(checkTimer)
  })

  const accent = RGBA.fromInts(212, 176, 140)

  // 1. Static Renderer (For GIZZI blocky text)
  function renderStaticLine(line: string) {
    return (
      <text fg={accent} attributes={TextAttributes.BOLD}>
        {line}
      </text>
    )
  }

  // 2. Pulse Renderer (For MATRIX_LOGO / "A" construct)
  function renderPulseLine(line: string) {
    // Synchronized pulse for the whole logo
    const pulse = Math.sin(tick() / 8)
    const brightness = 0.5 + (pulse * 0.5) // Range 0.0 to 1.0
    
    return (
      <text fg={RGBA.fromInts(
        Math.floor(212 * brightness), 
        Math.floor(176 * brightness), 
        Math.floor(140 * brightness)
      )} attributes={TextAttributes.BOLD}>
        {line}
      </text>
    )
  }

  // 3. Mascot Renderer (For Splash phase)
  function renderMascotLine(line: string, lineIdx: number) {
    let displayLine = line
    
    // Blinking logic: every ~3 seconds (90 ticks), blink for 150ms (5 ticks)
    const isBlinking = (tick() % 90) < 5
    if (isBlinking && lineIdx === 3) {
      // Replace eyes with dashes during blink
      displayLine = line.replace(/●/g, "-")
    }

    // Breathing pulse
    const pulse = Math.sin(tick() / 12)
    const brightness = 0.7 + (pulse * 0.3)
    
    return (
      <text fg={RGBA.fromInts(
        Math.floor(212 * brightness),
        Math.floor(176 * brightness),
        Math.floor(140 * brightness)
      )} attributes={TextAttributes.BOLD}>
        {displayLine}
      </text>
    )
  }

  return (
    <box flexDirection="column" alignItems="center" justifyContent="center" gap={2}>
      {/* CLI Phase */}
      <Show when={phase() === "cli"}>
        <box flexDirection="column" gap={0} marginBottom={2}>
          <For each={GIZZI_LOGO}>{(line) => renderStaticLine(line)}</For>
        </box>
        <box flexDirection="column" gap={1} marginTop={2} paddingLeft={4}>
          <For each={completedChecks()}>{(check) => (
            <text fg={RGBA.fromInts(39, 202, 64)} attributes={TextAttributes.BOLD}>✓ {check}</text>
          )}</For>
          {checkIndex() < SYSTEM_CHECKS.length && (
            <box flexDirection="row">
              <text fg={RGBA.fromInts(150, 150, 150)}>checking system... </text>
              <text fg={accent}>▋</text>
            </box>
          )}
        </box>
      </Show>

      {/* Transition Phase */}
      <Show when={phase() === "transition"}>
        <box flexDirection="column" alignItems="center" gap={1}>
          <text fg={RGBA.fromInts(212, 176, 140, 100)} attributes={TextAttributes.ITALIC}>[ TRANSITIONING ]</text>
        </box>
      </Show>

      {/* Stable Boot Container */}
      <Show when={["matrix", "tower", "logo", "splash"].includes(phase())}>
        <box flexDirection="column" alignItems="center">
          {/* THE GRAPHIC SLOT */}
          <box height={8} flexDirection="column" justifyContent="flex-end" gap={0}>
            <Show 
              when={phase() === "splash"} 
              fallback={<For each={MATRIX_LOGO}>{(line) => renderPulseLine(line)}</For>}
            >
              <For each={GIZZI_MASCOT}>{(line, i) => renderMascotLine(line, i())}</For>
            </Show>
          </box>
          
          <box height={1} />

          {/* THE CONTENT AREA */}
          <box height={10} flexDirection="column" alignItems="center" justifyContent="flex-start">
            <Switch>
              <Match when={phase() === "matrix"}>
                <box marginTop={1}>
                  <text fg={accent} attributes={TextAttributes.BOLD}>[ INITIALIZING ]</text>
                </box>
              </Match>

              <Match when={phase() === "tower"}>
                <box flexDirection="column" gap={0} alignItems="center">
                  <text fg={accent} attributes={TextAttributes.BOLD}>[ system initialized ]</text>
                  <text fg={RGBA.fromInts(150, 150, 150)} attributes={TextAttributes.BOLD}>[ loading kernels ]</text>
                </box>
              </Match>

              <Match when={phase() === "logo"}>
                <box marginTop={1} flexDirection="row">
                  <text fg={accent} attributes={TextAttributes.BOLD}>{typedText()}</text>
                  <text fg={RGBA.fromInts(255, 255, 255)} attributes={TextAttributes.BOLD}> ▋</text>
                </box>
              </Match>

              <Match when={phase() === "splash"}>
                <box flexDirection="column" alignItems="center" gap={1}>
                  <text fg={accent} attributes={TextAttributes.BOLD}>{GIZZI_CODE_TEXT}</text>
                  <box borderStyle="single" borderColor={RGBA.fromInts(212, 176, 140, 150)} paddingX={3} paddingY={1} marginTop={1}>
                    <box flexDirection="column" gap={0} alignItems="center">
                      <text fg={RGBA.fromInts(200, 200, 200)} attributes={TextAttributes.BOLD}>System: Ready</text>
                      <text fg={RGBA.fromInts(180, 180, 180)}>User: macbook</text>
                      <text fg={RGBA.fromInts(150, 150, 150)}>Session: 0x7f8a3b2c1d</text>
                    </box>
                  </box>
                </box>
              </Match>
            </Switch>
          </box>
        </box>
      </Show>
    </box>
  )
}
