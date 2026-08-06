/**
 * anydoc-backed document → GFM Markdown conversion.
 *
 * Firecrawl's anydoc (Rust core, napi prebuilds) converts
 * Word/PowerPoint/Excel/OpenDocument/RTF/EPUB/CSV/PDF bytes to clean GFM
 * Markdown. The binding is loaded defensively: when the napi prebuild is
 * unavailable the service still starts and /health reports anydoc as
 * unavailable, and /markdown answers 503.
 */

import { createRequire } from 'node:module'
import { extname } from 'node:path'
import type { ConvertErrorCode, Format } from '@firecrawl/anydoc'

type AnydocModule = typeof import('@firecrawl/anydoc')

let anydoc: AnydocModule | null = null
let anydocLoadError: string | null = null

try {
  anydoc = await import('@firecrawl/anydoc')
} catch (err) {
  anydocLoadError = (err as Error).message
}

const ANYDOC_VERSION = anydoc
  ? (createRequire(import.meta.url)('@firecrawl/anydoc/package.json') as { version: string }).version
  : null

/** anydoc engine status for /health. */
export function anydocStatus(): string {
  return anydoc
    ? `@firecrawl/anydoc ${ANYDOC_VERSION}`
    : `unavailable (napi binding failed to load: ${anydocLoadError ?? 'unknown'})`
}

/** Stable error shape surfaced by /markdown and /markdown-url: `{ code, message }`. */
export class MarkdownConversionError extends Error {
  constructor(
    public readonly code: ConvertErrorCode | 'unavailable' | 'unknown' | 'invalidUrl' | 'blockedUrl',
    message: string,
  ) {
    super(message)
    this.name = 'MarkdownConversionError'
  }
}

export interface MarkdownConversion {
  markdown: string
  format: Format
  title?: string
}

/**
 * Convert raw document bytes to GFM Markdown. The format is taken from the
 * filename extension when anydoc knows it (signature-less formats like CSV
 * need this), with content-based detection as the fallback. Throws
 * MarkdownConversionError; 'unsupported' maps to 415, everything else to 422.
 */
export async function convertToMarkdown(bytes: Uint8Array, filename: string): Promise<MarkdownConversion> {
  if (!anydoc) {
    throw new MarkdownConversionError(
      'unavailable',
      `anydoc napi binding failed to load: ${anydocLoadError ?? 'unknown'}`,
    )
  }

  const ext = extname(filename).replace(/^\./, '').toLowerCase()
  const format = (ext ? anydoc.formatFromExtension(ext) : null) ?? anydoc.formatFromBytes(bytes)
  if (!format) {
    throw new MarkdownConversionError(
      'unsupported',
      `no supported document format for '${filename}'`,
    )
  }

  let markdown: string
  try {
    markdown = await anydoc.toMarkdownBytes(bytes, format)
  } catch (err) {
    const code = (err as { code?: ConvertErrorCode }).code ?? 'unknown'
    throw new MarkdownConversionError(code, (err as Error).message)
  }

  if (!markdown.trim()) {
    throw new MarkdownConversionError('malformed', 'conversion produced no markdown')
  }

  return { markdown, format, title: extractMarkdownTitle(markdown) }
}

/** First ATX heading, used as the artifact title when present. */
function extractMarkdownTitle(markdown: string): string | undefined {
  for (const line of markdown.split('\n')) {
    const match = /^#{1,6}\s+(.+)$/.exec(line.trim())
    if (match) return match[1].trim()
  }
  return undefined
}
