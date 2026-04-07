/**
 * File suggestion types
 */

export interface FileSuggestion {
  path: string
  relevance: number
  reason?: string
}
export interface FileSuggestionCommandInput {
  query: string
  context?: Record<string, unknown>
  maxResults?: number
  }
