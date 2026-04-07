import { useTerminalDimensions } from "@opentui/solid"
import { createMemo } from "solid-js"
import { GIZZIBrand } from "@/shared/brand/meta"

export type BrandBannerVariant = "off" | "minimal" | "full"

export const GIZZI_BRAND = GIZZIBrand

function env() {
  return (process.env.GIZZI_BANNER ?? "").trim().toLowerCase()
}

export function useBrand() {
  const dimensions = useTerminalDimensions()
  const banner = createMemo<BrandBannerVariant>(() => {
    const mode = env()
    if (mode === "off") return "off"
    if (mode === "minimal") return "minimal"
    if (mode === "full") return "full"
    return dimensions().width < 80 ? "minimal" : "full"
  })

  return {
    ...GIZZI_BRAND,
    banner,
  }
}
