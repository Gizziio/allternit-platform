/**
 * Token Utilities
 */

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function countTokens(text: string): number {
  return estimateTokens(text)
}
