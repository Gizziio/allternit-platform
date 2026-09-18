import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { resolveSidecarBinary, XlsxSidecarClient, type OpenWorkbookResult } from '../src/index'

const WORKBOOK_XML = `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`
const WORKBOOK_RELS_XML = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
const SHEET_XML = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>7</v></c><c r="B1"><v>42</v></c></row></sheetData></worksheet>`

async function makeFixtureXlsx(): Promise<{ dir: string; path: string }> {
  const zip = new JSZip()
  zip.file('xl/workbook.xml', WORKBOOK_XML)
  zip.file('xl/_rels/workbook.xml.rels', WORKBOOK_RELS_XML)
  zip.file('xl/worksheets/sheet1.xml', SHEET_XML)
  const dir = mkdtempSync(join(tmpdir(), 'xlsx-engine-test-'))
  const path = join(dir, 'fixture.xlsx')
  writeFileSync(path, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
  return { dir, path }
}

const binary = resolveSidecarBinary()
const runIfSidecar = binary ? describe : describe.skip
const clients: XlsxSidecarClient[] = []

afterAll(() => {
  for (const client of clients) client.stop()
})

runIfSidecar('xlsx sidecar (requires `pnpm sidecar:build`)', () => {
  it('resolves the built sidecar binary', () => {
    expect(binary).toBeTruthy()
  })

  it('opens a workbook, reads a range, and closes the session', async () => {
    const { dir, path } = await makeFixtureXlsx()
    try {
      const client = new XlsxSidecarClient(binary!)
      clients.push(client)

      const opened = (await client.open(path)) as OpenWorkbookResult
      expect(typeof opened.sessionId).toBe('string')
      expect(opened.sheets).toHaveLength(1)
      expect(opened.sheets![0].name).toBe('Data')

      const range = (await client.readRange({
        sessionId: opened.sessionId,
        sheetId: opened.sheets![0].id,
        range: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 1 },
      })) as unknown
      // Exact RangeResult shape is the crate's; the values must survive the trip.
      expect(JSON.stringify(range)).toContain('42')

      await expect(client.close(opened.sessionId)).resolves.toBeUndefined()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 30_000)

  it('rejects cleanly when the workbook does not exist', async () => {
    const client = new XlsxSidecarClient(binary!)
    clients.push(client)
    await expect(client.open('/nonexistent/missing.xlsx')).rejects.toThrow()
  }, 30_000)
})
