import { describe, expect, it } from 'vitest'
import app from '../src/index'
import { buildBlankDocx, saveDocx } from '@allternit/office-docx-engine'

async function makeSampleDocx(): Promise<Uint8Array<ArrayBuffer>> {
  const blank = await buildBlankDocx()
  const doc = await (await import('@allternit/office-docx-engine')).parseDocx(blank)
  const saved = await saveDocx(doc, [
    { kind: 'generated', block: { type: 'heading', level: 1, runs: [{ text: 'Anydoc Markdown Test' }] } },
    { kind: 'generated', block: { type: 'paragraph', runs: [{ text: 'Body text for the markdown endpoint.' }] } },
  ])
  return new Uint8Array(saved)
}

/** Minimal single-page text PDF with a correct xref table. */
function makeSamplePdf(): Uint8Array<ArrayBuffer> {
  const content = 'BT /F1 24 Tf 72 720 Td (Hello anydoc PDF) Tj ET'
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
  return new Uint8Array(new TextEncoder().encode(pdf))
}

describe('office-engine /markdown (anydoc)', () => {
  it('reports anydoc on /health', async () => {
    const res = await app.fetch(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { engines: Record<string, string> }
    expect(body.engines.anydoc).toContain('@firecrawl/anydoc')
  })

  it('converts a .docx payload to non-empty GFM markdown', async () => {
    const bytes = await makeSampleDocx()
    const res = await app.fetch(
      new Request('http://localhost/markdown', {
        method: 'POST',
        headers: { 'x-office-filename': 'sample.docx' },
        body: bytes,
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      type: string
      filename: string
      mimeType: string
      format: string
      markdown: string
      stats: { textLength: number }
      engine: { name: string }
    }
    expect(body.type).toBe('markdown-conversion')
    expect(body.filename).toBe('sample.docx')
    expect(body.mimeType).toBe('text/markdown')
    expect(body.format).toBe('docx')
    expect(body.markdown).toContain('Anydoc Markdown Test')
    expect(body.stats.textLength).toBe(body.markdown.length)
    expect(body.engine.name).toBe('@firecrawl/anydoc')
  })

  it('converts a text-based .pdf payload to non-empty markdown', async () => {
    const res = await app.fetch(
      new Request('http://localhost/markdown', {
        method: 'POST',
        headers: { 'x-office-filename': 'hello.pdf' },
        body: makeSamplePdf(),
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { format: string; markdown: string }
    expect(body.format).toBe('pdf')
    expect(body.markdown).toContain('Hello anydoc PDF')
  })

  it('converts a .csv payload to a markdown table', async () => {
    const res = await app.fetch(
      new Request('http://localhost/markdown', {
        method: 'POST',
        headers: { 'x-office-filename': 'data.csv' },
        body: new TextEncoder().encode('name,score\nalice,3\nbob,5\n'),
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { format: string; markdown: string }
    expect(body.format).toBe('csv')
    expect(body.markdown).toContain('|')
    expect(body.markdown).toContain('alice')
  })

  it('rejects an unsupported extension (.txt) with 415', async () => {
    const res = await app.fetch(
      new Request('http://localhost/markdown', {
        method: 'POST',
        headers: { 'x-office-filename': 'notes.txt' },
        body: new TextEncoder().encode('plain text is not a document format'),
      }),
    )
    expect(res.status).toBe(415)
    const body = (await res.json()) as { error: string; code: string }
    expect(body.error).toBe('unsupported format')
    expect(body.code).toBe('unsupported')
  })

  it('rejects an empty body with 400', async () => {
    const res = await app.fetch(new Request('http://localhost/markdown', { method: 'POST' }))
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe('empty body')
  })
})
