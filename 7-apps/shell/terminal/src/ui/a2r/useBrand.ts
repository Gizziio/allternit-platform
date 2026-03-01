import { useTerminalDimensions } from "@opentui/solid"
import { createMemo } from "solid-js"
import { A2RBrand } from "@/brand/meta"

export type BrandBannerVariant = "off" | "minimal" | "full"

export const A2R_BRAND = A2RBrand

function env() {
  return (process.env.A2R_BANNER ?? "").trim().toLowerCase()
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
    ...A2R_BRAND,
    banner,
  }
}
