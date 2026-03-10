const WEB_TOOL_EXACT = new Set([
  "websearch",
  "webfetch",
  "codesearch",
  "google_search",
  "grep_app_searchgithub",
])

export function isWebToolName(tool: string): boolean {
  const id = tool.trim().toLowerCase()
  if (!id) return false
  if (WEB_TOOL_EXACT.has(id)) return true

  if (id.startsWith("websearch")) return true
  if (id.startsWith("webfetch")) return true
  if (id.startsWith("codesearch")) return true
  if (id.startsWith("google_search")) return true

  // Plugin tools can namespace web search handlers (for example Exa).
  if (id.includes("_web_search_")) return true
  if (id.endsWith("_web_search")) return true
  if (id.includes("searchgithub")) return true

  return false
}

