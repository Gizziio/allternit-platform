/**
 * Markdown Config Loader
 */

export interface MarkdownConfig {
  theme?: string
  highlight?: boolean
}

export function loadMarkdownConfig(): MarkdownConfig {
  return {}
}

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseFrontmatter } from './frontmatterParser.js'

export interface MarkdownFileEntry {
  filePath: string
  baseDir: string
  frontmatter: Record<string, unknown>
  content: string
  source: string
}

/** Load and frontmatter-parse every .md file in <cwd>/<subdir>. */
export async function loadMarkdownFilesForSubdir(subdir: string, cwd: string): Promise<MarkdownFileEntry[]> {
  const baseDir = join(cwd, subdir)
  let names: string[]
  try {
    names = await readdir(baseDir)
  } catch {
    return []
  }
  const entries: MarkdownFileEntry[] = []
  for (const name of names.sort()) {
    if (!name.endsWith('.md')) continue
    const filePath = join(baseDir, name)
    try {
      const raw = await readFile(filePath, 'utf8')
      const { frontmatter, body } = parseFrontmatter(raw)
      entries.push({ filePath, baseDir, frontmatter, content: body, source: 'project' })
    } catch {
      // Unreadable file — skip.
    }
  }
  return entries
}

/** First meaningful line of a markdown body, used as a fallback description. */
export function extractDescriptionFromMarkdown(content: string, kind: string): string | undefined {
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    return trimmed.replace(/^#+\s*/, '')
  }
  console.warn(`[markdown] no description found for ${kind}`)
  return undefined
}
