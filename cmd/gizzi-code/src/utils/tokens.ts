/**
 * Token Utilities
 */

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function countTokens(text: string): number {
  return estimateTokens(text)
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export * from '../shared/utils/tokens.js'
