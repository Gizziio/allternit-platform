/**
 * String utilities
 * Production implementation with all required exports
 */

// Escape special regex characters
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Capitalize first letter
export function capitalize(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Pluralize a word
export function plural(
  count: number,
  singular: string,
  plural?: string,
  includeCount = true,
): string {
  const p = plural ?? `${singular}s`
  const word = count === 1 ? singular : p
  return includeCount ? `${count} ${word}` : word
}

// Get first line of a string
export function firstLineOf(s: string): string {
  const idx = s.indexOf('\n')
  return idx === -1 ? s : s.slice(0, idx)
}

// Count occurrences of a character in a string
export function countCharInString(str: string, char: string): number {
  let count = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === char) count++
  }
  return count
}

// Normalize full-width digits to ASCII
export function normalizeFullWidthDigits(input: string): string {
  return input.replace(/[\uFF10-\uFF19]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  )
}

// Normalize full-width space to ASCII space
export function normalizeFullWidthSpace(input: string): string {
  return input.replace(/\u3000/g, ' ')
}

// Join lines with safe handling of undefined values
export function safeJoinLines(
  lines: (string | undefined | null)[],
  separator = '\n',
): string {
  return lines.filter((l): l is string => l != null && l !== '').join(separator)
}

// Truncate text to a maximum number of lines
export function truncateToLines(text: string, maxLines: number): string {
  const lines = text.split('\n')
  if (lines.length <= maxLines) return text
  return lines.slice(0, maxLines).join('\n') + '\n… (truncated)'
}

// Truncating accumulator that builds text line by line
export class EndTruncatingAccumulator {
  private lines: string[] = []
  private _truncated = false

  constructor(
    private maxLines: number,
    private overflowIndicator = '\n… (truncated)',
  ) {}

  add(line: string): this {
    if (!this._truncated) {
      if (this.lines.length >= this.maxLines) {
        this._truncated = true
      } else {
        this.lines.push(line)
      }
    }
    return this
  }

  get truncated(): boolean {
    return this._truncated
  }

  toString(): string {
    const lines = this._truncated
      ? [...this.lines, this.overflowIndicator]
      : this.lines
    return lines.join('\n')
  }

  get lineCount(): number {
    return this.lines.length
  }
}
