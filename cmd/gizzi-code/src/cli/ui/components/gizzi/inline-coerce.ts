export function inlineText(value: unknown): string {
  if (value == null || typeof value === "boolean") return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") return String(value)

  if (Array.isArray(value)) {
    return value.map((item) => inlineText(item)).join("")
  }

  if (typeof value === "function") {
    try {
      return inlineText(value())
    } catch {
      return ""
    }
  }

  if (typeof value === "object") {
    if (value instanceof Error) return value.message || String(value)

    const maybeChildren = (value as any)?.props?.children
    if (maybeChildren !== undefined) return inlineText(maybeChildren)

    try {
      const rendered = String(value)
      if (rendered !== "[object Object]" && rendered !== "[object Function]") return rendered
    } catch {}

    try {
      const json = JSON.stringify(value)
      if (json && json !== "{}") return json
    } catch {}
  }

  return ""
}

export function blockValue(value: unknown): { text?: string } {
  if (value == null || typeof value === "boolean") return {}
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
    return { text: String(value) }
  }

  if (Array.isArray(value)) {
    const text = inlineText(value)
    return text ? { text } : {}
  }

  if (typeof value === "function") {
    try {
      return blockValue(value())
    } catch {
      return {}
    }
  }

  if (typeof value === "object") {
    const text = inlineText(value)
    return text ? { text } : {}
  }

  return {}
}
