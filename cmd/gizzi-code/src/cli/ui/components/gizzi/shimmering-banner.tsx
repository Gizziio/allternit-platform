import { For, createMemo, createSignal, onMount, onCleanup } from "solid-js"
import { useGIZZITheme } from "@/cli/ui/components/gizzi/theme"
import { RGBA } from "@opentui/core"

const GIZZIIO_LOGO = [
  " ▄████▄  ▄█  ██████  ██████  ▄█  ▄█  ▄████▄ ",
  " ██  ▀▀  ██     ▄█▀     ▄█▀  ██  ██  ██  ██ ",
  " ██  ▄▄  ██   ▄█▀     ▄█▀    ██  ██  ██  ██ ",
  " ▀████▀  ▀█  ██████  ██████  ▀█  ▀█  ▀████▀ ",
]

export function ShimmeringBanner() {
  const tone = useGIZZITheme()
  const [tick, setTick] = createSignal(0)
  
  let timer: any
  onMount(() => {
    timer = setInterval(() => setTick(t => t + 1), 50)
  })
  onCleanup(() => clearInterval(timer))

  function renderLine(line: string, lineIndex: number) {
    const chars = line.split("")
    const accent = tone().accent
    const muted = tone().muted
    
    return (
      <text>
        <For each={chars}>
          {(char, charIndex) => {
            // Shimmer logic: a wave that travels across
            const pos = charIndex() + lineIndex * 5
            const wave = Math.sin((pos - tick()) / 4)
            
            let color = accent
            if (wave > 0.8) {
              // Highlight peak
              color = RGBA.fromInts(255, 255, 255)
            } else if (wave < -0.5) {
              // Muted valley
              color = muted
            }
            
            return <span style={{ fg: color, bold: wave > 0.5 }}>{char}</span>
          }}
        </For>
      </text>
    )
  }

  return (
    <box flexDirection="column" alignItems="center">
      <box flexDirection="column">
        <For each={GIZZIIO_LOGO}>
          {(line, index) => renderLine(line, index())}
        </For>
      </box>
    </box>
  )
}
