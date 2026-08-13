// @ts-nocheck
/**
 * Session memory search.
 *
 * Provides local, full-text search over the current session memory markdown
 * file. Results are returned as matching sections so the TUI can render them
 * without parsing the full file.
 */

import { getSessionMemoryContent } from './sessionMemoryUtils.js'

export type SessionMemorySearchResult = {
  section: string
  line: number
  excerpt: string
  score: number
}

export type SessionMemorySearchOptions = {
  /** Maximum number of results to return. */
  limit?: number
  /** Case-insensitive search when true (default). */
  ignoreCase?: boolean
  /** Return only results with score >= threshold. */
  minScore?: number
}

/**
 * Search the current session memory file for a query string.
 * Returns ranked section matches. A simple Phase 1 implementation using
 * substring frequency; semantic search can be layered in later phases.
 */
export async function searchSessionMemory(
  query: string,
  options: SessionMemorySearchOptions = {},
): Promise<SessionMemorySearchResult[]> {
  const content = await getSessionMemoryContent()
  if (content === null || content.trim().length === 0) {
    return []
  }

  const { limit = 10, ignoreCase = true, minScore = 0 } = options
  const normalizedQuery = ignoreCase ? query.toLowerCase() : query
  const queryTerms = normalizedQuery
    .split(/\s+/)
    .filter(term => term.length > 0)

  if (queryTerms.length === 0) {
    return []
  }

  const lines = content.split('\n')
  const sections: { header: string; startLine: number; body: string }[] = []
  let currentHeader = 'Session memory'
  let currentStartLine = 1
  let currentBody: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('# ')) {
      if (currentBody.length > 0) {
        sections.push({
          header: currentHeader,
          startLine: currentStartLine,
          body: currentBody.join('\n'),
        })
      }
      currentHeader = line.slice(2).trim()
      currentStartLine = i + 1
      currentBody = []
    } else {
      currentBody.push(line)
    }
  }

  if (currentBody.length > 0) {
    sections.push({
      header: currentHeader,
      startLine: currentStartLine,
      body: currentBody.join('\n'),
    })
  }

  const results: SessionMemorySearchResult[] = []
  for (const section of sections) {
    const normalizedBody = ignoreCase ? section.body.toLowerCase() : section.body
    let score = 0
    for (const term of queryTerms) {
      let index = 0
      while ((index = normalizedBody.indexOf(term, index)) !== -1) {
        score += 1
        index += term.length
      }
    }

    if (score > minScore) {
      const excerpt = makeExcerpt(section.body, queryTerms, ignoreCase)
      results.push({
        section: section.header,
        line: section.startLine,
        excerpt,
        score,
      })
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, limit)
}

function makeExcerpt(
  body: string,
  queryTerms: string[],
  ignoreCase: boolean,
  maxLength = 160,
): string {
  const normalizedBody = ignoreCase ? body.toLowerCase() : body
  let firstIndex = -1
  for (const term of queryTerms) {
    const idx = normalizedBody.indexOf(term)
    if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) {
      firstIndex = idx
    }
  }

  if (firstIndex === -1) {
    return body.slice(0, maxLength).trim()
  }

  const start = Math.max(0, firstIndex - 40)
  const end = Math.min(body.length, start + maxLength)
  let excerpt = body.slice(start, end).trim()
  if (start > 0) excerpt = `…${excerpt}`
  if (end < body.length) excerpt = `${excerpt}…`
  return excerpt
}
