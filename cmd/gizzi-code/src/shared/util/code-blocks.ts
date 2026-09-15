export interface CodeBlock {
  language?: string
  code: string
  startIndex: number
  endIndex: number
}

/**
 * Extract code blocks from markdown text
 * Supports fenced code blocks (```)
 */
export function extractCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  const fenceRegex = /^```(\w+)?\n([\s\S]*?)^```$/gm

  let match
  while ((match = fenceRegex.exec(text)) !== null) {
    const [fullMatch, language, code] = match
    blocks.push({
      language: language || undefined,
      code: code.trimEnd(),
      startIndex: match.index,
      endIndex: match.index + fullMatch.length,
    })
  }

  return blocks
}

/**
 * Get the first code block from text
 */
export function getFirstCodeBlock(text: string): CodeBlock | undefined {
  const blocks = extractCodeBlocks(text)
  return blocks[0]
}

/**
 * Check if text contains any code blocks
 */
export function hasCodeBlocks(text: string): boolean {
  return /^```\w*\n/m.test(text)
}

/**
 * Get all code as a single string (for copying all blocks)
 */
export function getAllCode(text: string): string {
  const blocks = extractCodeBlocks(text)
  return blocks.map((b) => b.code).join("\n\n")
}

/**
 * Get all code blocks from text (alias for extractCodeBlocks)
 */
export function getAllCodeBlocks(text: string): CodeBlock[] {
  return extractCodeBlocks(text)
}
