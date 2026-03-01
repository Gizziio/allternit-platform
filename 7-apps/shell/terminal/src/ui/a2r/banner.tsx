import { For, Show, createMemo } from "solid-js"
import { useA2RTheme } from "./theme"
import { useBrand, type BrandBannerVariant } from "./useBrand"
import { useAnimation } from "@/ui/animation"

const FULL = ["A://RCHITECH", "KERNEL | RECEIPTS | DAG"]

const TAGLINES = [
  ["A2R", "&", "Coffee"],
  ["ARCHITECT", "|", "MONOLITH"],
  ["BUILDING", "THE", "FUTURE"],
  ["KRNL", "SYNC", "READY"],
  ["RECEIPT", "SEALED", "DAG"],
  ["SCHEMATICS", "ONLINE", "A2R"],
  ["PRECISION", "ENFORCED", "LAW"],
]

export function A2RBanner(props: { variant?: BrandBannerVariant }) {
  const tone = useA2RTheme()
  const brand = useBrand()
  const animation = useAnimation()
  const variant = createMemo(() => props.variant ?? brand.banner())
  
  // Pick a random tagline on mount
  const taglineIndex = createMemo(() => Math.floor(Math.random() * TAGLINES.length))
  const tagline = createMemo(() => TAGLINES[taglineIndex()])

  // Subtle rhythmic pulse for the separator
  const isPulse = createMemo(() => (animation.tick() % 40n) < 5n)

  return (
    <Show when={variant() !== "off"}>
      <SwitchBanner variant={variant()} />
    </Show>
  )

  function SwitchBanner(input: { variant: BrandBannerVariant }) {
    return (
      <Show
        when={input.variant === "full"}
        fallback={
          <text fg={tone().accent}>
            <span style={{ bold: true }}>{brand.minimal}</span>
          </text>
        }
      >
        <box flexDirection="column" alignItems="center">
          <For each={FULL}>
            {(line, index) => (
              <text fg={index() === 0 ? tone().accent : tone().muted}>
                <span style={{ bold: index() === 0 }}>{line}</span>
              </text>
            )}
          </For>
          <box height={1} />
          <text>
            <span style={{ fg: tone().fg }}>{tagline()[0]} </span>
            <span style={{ fg: isPulse() ? tone().fg : tone().accent, bold: isPulse() }}>{tagline()[1]}</span>
            <span style={{ fg: tone().fg }}> {tagline()[2]}</span>
          </text>
        </box>
      </Show>
    )
  }
}
