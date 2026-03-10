import { GIZZIBrand } from "@/shared/brand/meta"

export function sanitizeBrandSurface(value: string): string {
  if (!value) return ""
  return value
    .replace(/\bohmygizzi\b/gi, "gizzi").replace(/\bohmygizzi\b/gi, "gizzi")
    .replace(/\bopen[\s-]?code\b/gi, GIZZIBrand.product)
}
