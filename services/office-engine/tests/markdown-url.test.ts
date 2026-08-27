import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import app from '../src/index'

/**
 * /markdown-url tests. The SSRF guard blocks loopback hosts by default, so the
 * local fixture server is exercised with OFFICE_ENGINE_ALLOW_PRIVATE_URLS=1
 * (read per-request; the blocked-host cases toggle it off again).
 */

const HTML_PAGE = `<!doctype html>
<html>
<head><title>Fixture Article</title></head>
<body>
<nav><a href="/a">NavJunkLink</a><a href="/b">MoreNavJunk</a></nav>
<article>
<h1>Article Heading</h1>
<p>This is the first substantial paragraph of the fixture article. It carries enough
prose for the readability scorer to treat the article element as the main content of
the page rather than boilerplate chrome around it.</p>
<p>A second paragraph keeps the density up so extraction stays deterministic across
runs of the test suite, with <strong>bold text</strong> and a <a href="https://example.com">real link</a>.</p>
</article>
<footer>FooterJunk</footer>
</body>
</html>`

/** Minimal single-page text PDF with a correct xref table. */
function makeSamplePdf(): Buffer {
  const content = 'BT /F1 24 Tf 72 720 Td (Hello anydoc URL PDF) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return Buffer.from(pdf)
}

let server: Server
let baseUrl: string

beforeAll(async () => {
  const pdf = makeSamplePdf()
  server = createServer((req, res) => {
    if (req.url === '/article') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(HTML_PAGE)
      return
    }
    if (req.url === '/document.pdf') {
      res.writeHead(200, { 'content-type': 'application/pdf' })
      res.end(pdf)
      return
    }
    if (req.url === '/gone') {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('not found')
      return
    }
    res.writeHead(400)
    res.end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
})

function postUrl(url: unknown) {
  return app.fetch(
    new Request('http://localhost/markdown-url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    }),
  )
}

describe('office-engine /markdown-url', () => {
  it('converts an HTML page to GFM with the article content only', async () => {
    process.env.OFFICE_ENGINE_ALLOW_PRIVATE_URLS = '1'
    const res = await postUrl(`${baseUrl}/article`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      type: string
      format: string
      title: string
      sourceUrl: string
      markdown: string
      stats: { textLength: number }
      engine: { name: string }
    }
    expect(body.type).toBe('markdown-conversion')
    expect(body.format).toBe('html')
    expect(body.sourceUrl).toBe(`${baseUrl}/article`)
    expect(body.title).toBeTruthy()
    expect(body.markdown).toContain('Article Heading')
    expect(body.markdown).toContain('bold text')
    expect(body.markdown).not.toContain('NavJunkLink')
    expect(body.markdown).not.toContain('FooterJunk')
    expect(body.stats.textLength).toBe(body.markdown.length)
    expect(body.engine.name).toBe('readability+turndown')
  })

  it('passes a document content-type through the anydoc path', async () => {
    process.env.OFFICE_ENGINE_ALLOW_PRIVATE_URLS = '1'
    const res = await postUrl(`${baseUrl}/document.pdf`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { format: string; markdown: string; engine: { name: string } }
    expect(body.format).toBe('pdf')
    expect(body.markdown).toContain('Hello anydoc URL PDF')
    expect(body.engine.name).toBe('@firecrawl/anydoc')
  })

  it('rejects private/loopback URLs with 400 when the guard is active', async () => {
    delete process.env.OFFICE_ENGINE_ALLOW_PRIVATE_URLS
    for (const url of [`${baseUrl}/article`, 'http://localhost/x', 'http://192.168.1.10/x', 'http://10.0.0.4/x']) {
      const res = await postUrl(url)
      expect(res.status).toBe(400)
      expect(((await res.json()) as { code: string }).code).toBe('blockedUrl')
    }
  })

  it('rejects non-http(s) and malformed URLs with 400', async () => {
    delete process.env.OFFICE_ENGINE_ALLOW_PRIVATE_URLS
    for (const url of ['file:///etc/passwd', 'not a url', 'ftp://example.com/x']) {
      const res = await postUrl(url)
      expect(res.status).toBe(400)
      expect(((await res.json()) as { code: string }).code).toBe('invalidUrl')
    }
  })

  it('maps a non-200 upstream response to 422', async () => {
    process.env.OFFICE_ENGINE_ALLOW_PRIVATE_URLS = '1'
    const res = await postUrl(`${baseUrl}/gone`)
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string; detail: string }
    expect(body.error).toBe('conversion failed')
    expect(body.detail).toContain('404')
  })

  it('rejects a malformed JSON envelope with 400', async () => {
    const res = await app.fetch(
      new Request('http://localhost/markdown-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nope: true }),
      }),
    )
    expect(res.status).toBe(400)
  })
})
