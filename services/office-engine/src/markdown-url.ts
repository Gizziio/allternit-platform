/**
 * URL → GFM Markdown conversion ("the other half" of anydoc, which is
 * documents-only by design).
 *
 * HTML pages: fetched server-side with SSRF guards, main content extracted
 * with @mozilla/readability (via linkedom), converted to GFM with turndown.
 * Document content-types at a URL (pdf/docx/...) are passed through to the
 * anydoc byte path (convertToMarkdown) — one endpoint for anything.
 */

import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import { convertToMarkdown, MarkdownConversionError } from './markdown'

const FETCH_TIMEOUT_MS = 15_000
const MAX_REDIRECTS = 5
const MAX_BODY_BYTES = 10 * 1024 * 1024
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Allternit/1.0 (+markdown-preview)'

// Lazy singleton (same idiom as gizzi-code's webfetch): turndown's domino
// import is heavy and one instance is stateless across calls.
// @types/turndown ships only `export =`, so TS types the import as the class
// itself while Node ESM wraps CJS in { default } — hence the cast.
type TurndownCtor = typeof import('turndown')
let turndownPromise: Promise<InstanceType<TurndownCtor>> | undefined
function getTurndown(): Promise<InstanceType<TurndownCtor>> {
  return (turndownPromise ??= import('turndown').then((m) => {
    const Turndown = (m as unknown as { default: TurndownCtor }).default
    return new Turndown({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
  }))
}

/**
 * SSRF guard: http/https only, and private/loopback/link-local hosts blocked.
 * The check is hostname-string based and happens BEFORE any DNS resolution —
 * a name that resolves to a private address (DNS rebinding, or /etc/hosts)
 * still passes. Accepted for v1 (single-user local deployment); a resolving
 * fetch with an address check is the follow-up hardening.
 *
 * OFFICE_ENGINE_ALLOW_PRIVATE_URLS=1 lifts the block for tests/local dev.
 */
function assertUrlAllowed(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new MarkdownConversionError('invalidUrl', `invalid URL: ${raw}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new MarkdownConversionError('invalidUrl', `only http/https URLs are supported`)
  }
  if (process.env.OFFICE_ENGINE_ALLOW_PRIVATE_URLS === '1') return url

  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
  const blocked =
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '::1' ||
    host === '0.0.0.0' ||
    isPrivateIpv4(host)
  if (blocked) {
    throw new MarkdownConversionError('blockedUrl', `refusing to fetch private/loopback host '${host}'`)
  }
  return url
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p))) return false
  const [a, b] = parts.map(Number)
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  )
}

/** Content-types that are documents for the anydoc byte path, not HTML. */
const DOCUMENT_EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-word.document.macroenabled.12': 'docm',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/vnd.oasis.opendocument.presentation': 'odp',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'application/epub+zip': 'epub',
  'text/csv': 'csv',
}

function documentExtForContentType(contentType: string | null): string | null {
  if (!contentType) return null
  const mime = contentType.split(';')[0].trim().toLowerCase()
  return DOCUMENT_EXT_BY_MIME[mime] ?? null
}

async function readBodyWithLimit(response: Response): Promise<Uint8Array> {
  const length = Number(response.headers.get('content-length') ?? 0)
  if (length > MAX_BODY_BYTES) {
    throw new MarkdownConversionError('resourceLimit', `response body exceeds ${MAX_BODY_BYTES} bytes`)
  }
  const body = response.body
  if (!body) return new Uint8Array()
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new MarkdownConversionError('resourceLimit', `response body exceeds ${MAX_BODY_BYTES} bytes`)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

/** Fetch with manual redirect following (≤5, each target re-validated). */
async function fetchGuarded(start: URL): Promise<{ response: Response; finalUrl: string }> {
  let url = start
  for (let redirects = 0; ; redirects++) {
    let response: Response
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml,application/pdf,application/octet-stream;q=0.9,*/*;q=0.8',
        },
      })
    } catch (err) {
      throw new MarkdownConversionError('io', `fetch failed: ${(err as Error).message}`)
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location) {
        throw new MarkdownConversionError('io', `redirect (${response.status}) without a location header`)
      }
      if (redirects >= MAX_REDIRECTS) {
        throw new MarkdownConversionError('io', `too many redirects (>${MAX_REDIRECTS})`)
      }
      url = assertUrlAllowed(new URL(location, url).toString())
      continue
    }
    if (!response.ok) {
      await response.body?.cancel()
      throw new MarkdownConversionError('io', `upstream returned ${response.status}`)
    }
    return { response, finalUrl: url.toString() }
  }
}

export interface UrlConversion {
  markdown: string
  /** 'html' for web pages, otherwise the detected document format. */
  format: string
  title?: string
  sourceUrl: string
}

export async function convertUrlToMarkdown(rawUrl: string): Promise<UrlConversion> {
  const url = assertUrlAllowed(rawUrl)
  const { response, finalUrl } = await fetchGuarded(url)

  const contentType = response.headers.get('content-type')
  const documentExt = documentExtForContentType(contentType)

  // Document at a URL: hand the bytes to the anydoc path.
  if (documentExt) {
    const bytes = await readBodyWithLimit(response)
    const basename = decodeURIComponent(url.pathname.split('/').pop() ?? '') || `download.${documentExt}`
    const filename = /\.[a-z0-9]+$/i.test(basename) ? basename : `${basename}.${documentExt}`
    const converted = await convertToMarkdown(bytes, filename)
    return { ...converted, sourceUrl: finalUrl }
  }

  const mime = (contentType ?? '').split(';')[0].trim().toLowerCase()
  if (mime && mime !== 'text/html' && mime !== 'application/xhtml+xml' && mime !== 'text/plain') {
    await response.body?.cancel()
    throw new MarkdownConversionError('unsupported', `cannot convert content-type '${mime}' from a URL`)
  }

  const html = new TextDecoder().decode(await readBodyWithLimit(response))
  let article: { title?: string | null; content?: string | null } | null
  try {
    const { document } = parseHTML(html)
    article = new Readability(document as unknown as Document).parse()
  } catch (err) {
    throw new MarkdownConversionError('malformed', `HTML extraction failed: ${(err as Error).message}`)
  }
  if (!article?.content) {
    throw new MarkdownConversionError('malformed', 'no readable article content found on the page')
  }

  const turndown = await getTurndown()
  const markdown = turndown.turndown(article.content)
  if (!markdown.trim()) {
    throw new MarkdownConversionError('malformed', 'conversion produced no markdown')
  }

  let title = article.title?.trim() || undefined
  if (!title) {
    const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html)
    title = match?.[1].trim() || undefined
  }

  return { markdown, format: 'html', title, sourceUrl: finalUrl }
}
