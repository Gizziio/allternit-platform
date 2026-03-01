import { A2RBrand } from "./meta"

export function sanitizeBrandSurface(value: string): string {
  if (!value) return ""
  return value
    .replace(/\bohmya2r\b/gi, "a2r").replace(/\bohmya2r\b/gi, "a2r")
    .replace(/\bopen[\s-]?code\b/gi, A2RBrand.product)
}
