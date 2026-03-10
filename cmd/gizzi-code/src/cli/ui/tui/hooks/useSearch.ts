import { createSignal, createMemo, createEffect } from "solid-js"
import fuzzysort from "fuzzysort"
import type { Message } from "@a2r/sdk/v2"

export interface SearchResult {
  messageID: string
  messageIndex: number
  preview: string
  matches: string[]
  score: number
}

export interface SearchState {
  query: string
  results: SearchResult[]
  currentIndex: number
}

function extractSearchableText(message: Message, parts: any[]): string {
  if (message.role === "user") {
    return (message as any).text ?? ""
  }
  // Assistant message - combine all text parts
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text)
    .join("\n")
}

function generatePreview(text: string, query: string, maxLength: number = 60): string {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)

  if (index === -1) {
    // Fuzzy match - just show start
    return text.slice(0, maxLength).replace(/\n/g, " ") + (text.length > maxLength ? "..." : "")
  }

  // Show context around match
  const contextStart = Math.max(0, index - 20)
  const contextEnd = Math.min(text.length, index + query.length + 30)
  let preview = text.slice(contextStart, contextEnd).replace(/\n/g, " ")

  if (contextStart > 0) preview = "..." + preview
  if (contextEnd < text.length) preview = preview + "..."

  return preview
}

export function useSearch(
  messages: () => Message[],
  getParts: (messageID: string) => any[],
) {
  const [query, setQuery] = createSignal("")
  const [currentIndex, setCurrentIndex] = createSignal(0)

  const searchableMessages = createMemo(() => {
    const msgs = messages()
    return msgs
      .map((msg, idx) => ({
        message: msg,
        index: idx,
        text: extractSearchableText(msg, getParts(msg.id)),
      }))
      .filter((item) => item.text.length > 0)
  })

  const results = createMemo<SearchResult[]>(() => {
    const q = query().trim()
    if (!q) return []

    const items = searchableMessages()
    if (items.length === 0) return []

    // Use fuzzysort for fuzzy matching
    const results = items.map((item) => {
      const result = fuzzysort.single(q, item.text)
      if (!result) return null

      return {
        messageID: item.message.id,
        messageIndex: item.index,
        preview: generatePreview(item.text, q),
        matches: result.target ? [result.target] : [],
        score: result.score,
      }
    })

    return results
      .filter((r): r is SearchResult => r !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50) // Limit results
  })

  const hasResults = createMemo(() => results().length > 0)
  const resultCount = createMemo(() => results().length)

  const currentResult = createMemo(() => {
    const r = results()
    if (r.length === 0) return undefined
    const idx = Math.min(currentIndex(), r.length - 1)
    return r[idx]
  })

  function nextResult() {
    const count = results().length
    if (count === 0) return
    setCurrentIndex((prev) => (prev + 1) % count)
  }

  function prevResult() {
    const count = results().length
    if (count === 0) return
    setCurrentIndex((prev) => (prev - 1 + count) % count)
  }

  function reset() {
    setQuery("")
    setCurrentIndex(0)
  }

  function goToResult(index: number) {
    const count = results().length
    if (count === 0) return
    setCurrentIndex(Math.max(0, Math.min(index, count - 1)))
  }

  return {
    query,
    setQuery,
    results,
    currentIndex,
    currentResult,
    hasResults,
    resultCount,
    nextResult,
    prevResult,
    reset,
    goToResult,
  }
}
