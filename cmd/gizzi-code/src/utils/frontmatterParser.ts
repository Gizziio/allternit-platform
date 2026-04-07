/**
 * Frontmatter Parser
 */

export interface Frontmatter {
  [key: string]: unknown
}

export function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const lines = content.split('\n')
  if (lines[0] !== '---') {
    return { frontmatter: {}, body: content }
  }
  
  const endIndex = lines.findIndex((line, i) => i > 0 && line === '---')
  if (endIndex === -1) {
    return { frontmatter: {}, body: content }
  }
  
  const frontmatterText = lines.slice(1, endIndex).join('\n')
  const body = lines.slice(endIndex + 1).join('\n')
  
  // Simple YAML-like parsing
  const frontmatter: Frontmatter = {}
  for (const line of frontmatterText.split('\n')) {
    const match = line.match(/^(\w+):\s*(.*)$/)
    if (match) {
      frontmatter[match[1]] = match[2]
    }
  }
  
  return { frontmatter, body }
}
