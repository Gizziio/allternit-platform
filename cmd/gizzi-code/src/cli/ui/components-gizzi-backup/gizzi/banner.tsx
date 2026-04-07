import { For, Show, createMemo } from "solid-js"
import { useGIZZITheme } from "@/cli/ui/components/gizzi/theme"
import { useBrand, type BrandBannerVariant } from "@/cli/ui/components/gizzi/useBrand"
import { useAnimation } from "@/cli/ui/components/animation"

const GIZZIIO_LOGO = [
  " ▄████▄  ▄█  ██████  ██████  ▄█  ▄█  ▄████▄ ",
  " ██  ▀▀  ██     ▄█▀     ▄█▀  ██  ██  ██  ██ ",
  " ██  ▄▄  ██   ▄█▀     ▄█▀    ██  ██  ██  ██ ",
  " ▀████▀  ▀█  ██████  ██████  ▀█  ▀█  ▀████▀ ",
]

const TAGLINES = [
  "AGENT | BRAIN | CODE",
  "INFRASTRUCTURE-GRADE INTELLIGENCE",
  "THE ARCHITECT MONOLITH",
  "PLAN | ACT | VERIFY",
]

export function GIZZIBanner(props: { variant?: BrandBannerVariant }) {
  const tone = useGIZZITheme()
  const brand = useBrand()
  const animation = useAnimation()
  const variant = createMemo(() => props.variant ?? brand.banner())
  
  // Pick a random tagline on mount
  const taglineIndex = createMemo(() => Math.floor(Math.random() * TAGLINES.length))
  const tagline = createMemo(() => TAGLINES[taglineIndex()])

  return (
    <Show when={variant() !== "off"}>
      <box flexDirection="column" alignItems="center" gap={1}>
        <Show when={variant() === "full"}>
          <box flexDirection="column">
            <For each={GIZZIIO_LOGO}>
              {(line) => (
                <text fg={tone().accent}>
                  <span style={{ bold: true }}>{line}</span>
                </text>
              )}
            </For>
          </box>
        </Show>
        <text fg={tone().muted}>
          <span>{tagline()}</span>
        </text>
      </box>
    </Show>
  )
}
