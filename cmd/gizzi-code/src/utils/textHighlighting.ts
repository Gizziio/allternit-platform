/**
 * Text Highlighting Utilities
 */

export type { TextHighlight } from '../shared/utils/textHighlighting.js'

export interface HighlightOptions {
  language?: string
  theme?: string
}

export function highlightText(text: string, options?: HighlightOptions): string {
  return text
}

export function highlightCode(code: string, language?: string): string {
  return code
}
