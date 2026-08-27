import { describe, expect, it } from 'vitest'
import app from '../src/index'
import { buildBlankDocx, saveDocx } from '@allternit/office-docx-engine'
import { resolveSidecarBinary } from '@allternit/office-xlsx-engine'
import PptxGenJS from 'pptxgenjs'
import JSZip from 'jszip'

async function makeSampleDocx(): Promise<Uint8Array<ArrayBuffer>> {
  const blank = await buildBlankDocx()
  const doc = await (await import('@allternit/office-docx-engine')).parseDocx(blank)
  const saved = await saveDocx(doc, [
    { kind: 'generated', block: { type: 'heading', level: 1, runs: [{ text: 'Allternit Office Engine Test' }] } },
    { kind: 'generated', block: { type: 'paragraph', runs: [{ text: 'This document validates the office-engine service.' }] } },
  ])
  return new Uint8Array(saved)
}

async function makeSamplePptx(): Promise<Uint8Array<ArrayBuffer>> {
  const p = new PptxGenJS()
  const slide1 = p.addSlide()
  slide1.addText('Allternit Engine Deck', { x: 0.5, y: 0.5, w: 8, h: 1, fontSize: 32 })
  slide1.addText('First slide body text', { x: 0.5, y: 1.8, w: 8, h: 1, fontSize: 18 })
  const slide2 = p.addSlide()
  slide2.addText('Second slide agenda', { x: 0.5, y: 0.5, w: 8, h: 1, fontSize: 24 })
  const buf = (await p.write({ outputType: 'nodebuffer' })) as Buffer
  return new Uint8Array(buf)
}

async function makeSampleXlsx(): Promise<Uint8Array<ArrayBuffer>> {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  )
  zip.file(
    '_rels/.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  )
  zip.file(
    'xl/workbook.xml',
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  )
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  )
  // IronCalc's importer requires <cellStyles> (it indexes [0] without a
  // guard); a styles.xml without it panics the sidecar.
  zip.file(
    'xl/styles.xml',
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  )
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>7</v></c><c r="B1"><f>A1*6</f><v>42</v></c></row></sheetData></worksheet>`,
  )
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return new Uint8Array(buf)
}

const xlsxSidecar = resolveSidecarBinary()

describe('office-engine service', () => {
  it('returns health status', async () => {
    const res = await app.fetch(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; service: string }
    expect(body.status).toBe('ok')
    expect(body.service).toBe('office-engine')
  })

  it('round-trips a .docx file', async () => {
    const bytes = await makeSampleDocx()
    const res = await app.fetch(
      new Request('http://localhost/docx/roundtrip', {
        method: 'POST',
        body: bytes,
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { originalSize: number; outputSize: number; changed: boolean }
    expect(body.originalSize).toBe(bytes.byteLength)
    expect(body.outputSize).toBeGreaterThan(0)
    expect(typeof body.changed).toBe('boolean')
  })

  it('parses a .docx file into an Allternit artifact', async () => {
    const bytes = await makeSampleDocx()
    const res = await app.fetch(
      new Request('http://localhost/parse', {
        method: 'POST',
        headers: { 'x-office-filename': 'sample.docx' },
        body: bytes,
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { type: string; title: string; extractedText: string; stats: object }
    expect(body.type).toBe('office-document')
    expect(body.title).toBe('Allternit Office Engine Test')
    expect(body.extractedText).toContain('Allternit Office Engine Test')
    expect(body.stats).toBeDefined()
  })

  it('reports loaded engines on /health', async () => {
    const res = await app.fetch(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { engines: Record<string, string> }
    expect(body.engines.docx).toBe('@allternit/office-docx-engine')
    expect(body.engines.pptx).toBe('@allternit/office-pptx-engine')
    expect(body.engines['file-parse']).toBe('@allternit/office-file-parse')
  })

  it('parses a .pptx file into an office-presentation artifact', async () => {
    const bytes = await makeSamplePptx()
    const res = await app.fetch(
      new Request('http://localhost/pptx/parse', {
        method: 'POST',
        headers: { 'x-office-filename': 'deck.pptx' },
        body: bytes,
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      type: string
      filename: string
      extractedText: string
      stats: { slideCount: number; textLength: number }
    }
    expect(body.type).toBe('office-presentation')
    expect(body.filename).toBe('deck.pptx')
    expect(body.stats.slideCount).toBe(2)
    expect(body.extractedText).toContain('## Slide 1')
    expect(body.extractedText).toContain('Allternit Engine Deck')
    expect(body.extractedText).toContain('Second slide agenda')
    expect(body.stats.textLength).toBe(body.extractedText.length)
  })

  it('round-trips a .pptx file', async () => {
    const bytes = await makeSamplePptx()
    const res = await app.fetch(
      new Request('http://localhost/pptx/roundtrip', {
        method: 'POST',
        body: bytes,
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { originalSize: number; outputSize: number; changed: boolean }
    expect(body.originalSize).toBe(bytes.byteLength)
    expect(body.outputSize).toBeGreaterThan(0)
    expect(typeof body.changed).toBe('boolean')
  })

  it('rejects empty bodies with 400 on the new endpoints', async () => {
    for (const path of ['/pptx/parse', '/pptx/roundtrip', '/extract']) {
      const res = await app.fetch(new Request(`http://localhost${path}`, { method: 'POST' }))
      expect(res.status).toBe(400)
      expect(((await res.json()) as { error: string }).error).toBe('empty body')
    }
  })

  it('rejects a non-pptx payload with 422', async () => {
    const res = await app.fetch(
      new Request('http://localhost/pptx/parse', {
        method: 'POST',
        headers: { 'x-office-filename': 'not-a-deck.pptx' },
        body: new TextEncoder().encode('definitely not a zip'),
      }),
    )
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string; detail: string }
    expect(body.error).toBe('parse failed')
    expect(body.detail).toBeTruthy()
  })

  it('extracts text from a .txt payload via /extract', async () => {
    const res = await app.fetch(
      new Request('http://localhost/extract', {
        method: 'POST',
        headers: { 'x-office-filename': 'notes.txt' },
        body: new TextEncoder().encode('hello office engine\nsecond line'),
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      type: string
      filename: string
      mimeType: string
      sizeBytes: number
      extractedText: string
      stats: { textLength: number }
      engine: { name: string }
    }
    expect(body.type).toBe('text-extraction')
    expect(body.filename).toBe('notes.txt')
    expect(body.mimeType).toBe('text/plain')
    expect(body.extractedText).toContain('hello office engine')
    expect(body.stats.textLength).toBe(body.extractedText.length)
    expect(body.engine.name).toBe('@allternit/office-file-parse')
  })

  it('extracts text from a .pptx payload via /extract', async () => {
    const bytes = await makeSamplePptx()
    const res = await app.fetch(
      new Request('http://localhost/extract', {
        method: 'POST',
        headers: { 'x-office-filename': 'deck.pptx' },
        body: bytes,
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { type: string; extractedText: string; mimeType: string }
    expect(body.type).toBe('text-extraction')
    expect(body.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    )
    expect(body.extractedText).toContain('Allternit Engine Deck')
  })

  it('extracts text from a .docx payload via /extract', async () => {
    const bytes = await makeSampleDocx()
    const res = await app.fetch(
      new Request('http://localhost/extract', {
        method: 'POST',
        headers: { 'x-office-filename': 'sample.docx' },
        body: bytes,
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { extractedText: string }
    expect(body.extractedText).toContain('Allternit Office Engine Test')
  })

  it('rejects an unsupported extension via /extract with 422', async () => {
    const res = await app.fetch(
      new Request('http://localhost/extract', {
        method: 'POST',
        headers: { 'x-office-filename': 'archive.zip' },
        body: new TextEncoder().encode('PK fake zip'),
      }),
    )
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error: string; detail: string }
    expect(body.error).toBe('extraction failed')
    expect(body.detail).toBeTruthy()
  })

  const xlsxIt = xlsxSidecar ? it : it.skip

  xlsxIt('parses a .xlsx file into an office-spreadsheet artifact', async () => {
    const bytes = await makeSampleXlsx()
    const res = await app.fetch(
      new Request('http://localhost/xlsx/parse', {
        method: 'POST',
        headers: { 'x-office-filename': 'book.xlsx' },
        body: bytes,
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      type: string
      filename: string
      stats: { sheetCount: number }
      sheets: { id: string; name: string }[]
    }
    expect(body.type).toBe('office-spreadsheet')
    expect(body.filename).toBe('book.xlsx')
    expect(body.stats.sheetCount).toBe(1)
    expect(body.sheets[0].name).toBe('Data')
  }, 30_000)

  xlsxIt('recalculates a workbook via /xlsx/recalc', async () => {
    const bytes = await makeSampleXlsx()
    const res = await app.fetch(
      new Request('http://localhost/xlsx/recalc', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workbookBase64: Buffer.from(bytes).toString('base64'),
          edits: [{ sheet: 'Data', row: 0, column: 0, input: '10' }],
          reads: [
            { sheet: 'Data', range: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 1 } },
          ],
        }),
      }),
    )
    expect(res.status).toBe(200)
    const text = JSON.stringify(await res.json())
    // A1 edited to 10; B1 = A1*6 must recompute to 60.
    expect(text).toContain('10')
    expect(text).toContain('60')
  }, 30_000)

  xlsxIt('reads a cell matrix via /xlsx/read', async () => {
    const bytes = await makeSampleXlsx()
    const res = await app.fetch(
      new Request('http://localhost/xlsx/read', {
        method: 'POST',
        headers: { 'x-office-filename': 'book.xlsx' },
        body: bytes,
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      sheets: {
        id: string
        name: string
        rowCount: number
        columnCount: number
        cells: { row: number; column: number; value?: unknown; formula?: string }[]
      }[]
    }
    expect(body.sheets).toHaveLength(1)
    expect(body.sheets[0].name).toBe('Data')
    const a1 = body.sheets[0].cells.find((c) => c.row === 0 && c.column === 0)
    const b1 = body.sheets[0].cells.find((c) => c.row === 0 && c.column === 1)
    expect(a1?.value).toBe(7)
    expect(b1?.formula).toBe('=A1*6')
    expect(b1?.value).toBe(42)
  }, 30_000)

  it('rejects empty bodies with 400 on /xlsx/read', async () => {
    const res = await app.fetch(new Request('http://localhost/xlsx/read', { method: 'POST' }))
    expect(res.status).toBe(400)
  })

  it('rejects a malformed /xlsx/recalc envelope with 400', async () => {
    const res = await app.fetch(
      new Request('http://localhost/xlsx/recalc', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nope: true }),
      }),
    )
    expect(res.status).toBe(400)
  })

  xlsxIt('runs a full workbook session: open → read → edit-save → close', async () => {
    const bytes = await makeSampleXlsx()
    const base64 = Buffer.from(bytes).toString('base64')

    // Open
    const openRes = await app.fetch(
      new Request('http://localhost/xlsx/session/open', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'session-test.xlsx', bytesBase64: base64 }),
      }),
    )
    expect(openRes.status).toBe(200)
    const file = (await openRes.json()) as {
      sessionId: string
      sheets: { id: string; name: string }[]
    }
    expect(file.sheets[0].name).toBe('Data')

    // Read a range
    const rangeRes = await app.fetch(
      new Request('http://localhost/xlsx/session/range', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: file.sessionId,
          sheetId: file.sheets[0].id,
          range: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 1 },
        }),
      }),
    )
    expect(rangeRes.status).toBe(200)
    expect(JSON.stringify(await rangeRes.json())).toContain('42')

    // Save with a cell edit (A1: 7 → 10); the full save-request shape is
    // required by the zod schema.
    const saveRes = await app.fetch(
      new Request('http://localhost/xlsx/session/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: file.sessionId,
          mode: 'save',
          edits: [
            { sheetId: file.sheets[0].id, row: 0, column: 0, value: 10, writeValue: true },
          ],
          structuralOps: [],
          chartEdits: [],
          visualEdits: [],
          visualAdditions: [],
          tableAdditions: [],
          pivotAdditions: [],
          sheetOps: [],
          sheetOrder: [],
          filterStates: [],
          hyperlinkEdits: [],
          cfStates: [],
          dvStates: [],
          pageSetupStates: [],
          noteStates: [],
          formulaValues: [],
          pivotCacheRefreshPaths: [],
          pivotRefreshUpdates: [],
          sheetProtections: [],
          definedNamesState: null,
        }),
      }),
    )
    expect(saveRes.status).toBe(200)
    const saved = (await saveRes.json()) as {
      canceled: boolean
      file: { sessionId: string }
      bytesBase64: string
    }
    expect(saved.canceled).toBe(false)
    expect(saved.bytesBase64.length).toBeGreaterThan(100)

    // The saved bytes carry the edit: reopen via /xlsx/read and check A1=10.
    const readRes = await app.fetch(
      new Request('http://localhost/xlsx/read', {
        method: 'POST',
        headers: { 'x-office-filename': 'saved.xlsx' },
        body: Buffer.from(saved.bytesBase64, 'base64'),
      }),
    )
    expect(readRes.status).toBe(200)
    const readBack = (await readRes.json()) as {
      sheets: { cells: { row: number; column: number; value?: unknown }[] }[]
    }
    const a1 = readBack.sheets[0].cells.find((c) => c.row === 0 && c.column === 0)
    expect(a1?.value).toBe(10)

    // Close the new session (save swapped sessions).
    const closeRes = await app.fetch(
      new Request('http://localhost/xlsx/session/close', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: saved.file.sessionId }),
      }),
    )
    expect(closeRes.status).toBe(200)
  }, 60_000)
})
