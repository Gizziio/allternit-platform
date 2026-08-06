/**
 * Minimal client-side .xlsx writer.
 *
 * Produces a workbook Excel, calamine, and IronCalc can all read back
 * (styles.xml must include <cellStyles> — IronCalc's importer indexes it
 * unguarded). Values and formulas only; no styling, merges, or shared
 * strings (strings are written inline).
 */
import JSZip from 'jszip'

export interface WriterCell {
  /** Text/number/boolean value, or null for formula-only cells. */
  value: string | number | boolean | null
  /** Formula without the leading '='. */
  formula?: string
}

export interface WriterSheet {
  name: string
  /** Sparse map "row,col" (0-based) → cell. */
  cells: Record<string, WriterCell>
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function columnName(index: number): string {
  let name = ''
  let n = index + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

function cellXml(row: number, col: number, cell: WriterCell): string {
  const ref = `${columnName(col)}${row + 1}`
  const formula = cell.formula ? `<f>${escapeXml(cell.formula)}</f>` : ''
  if (cell.formula && cell.value == null) {
    return `<c r="${ref}">${formula}</c>`
  }
  if (typeof cell.value === 'number') {
    return `<c r="${ref}">${formula}<v>${cell.value}</v></c>`
  }
  if (typeof cell.value === 'boolean') {
    return `<c r="${ref}" t="b">${formula}<v>${cell.value ? 1 : 0}</v></c>`
  }
  return `<c r="${ref}" t="inlineStr">${formula}<is><t>${escapeXml(String(cell.value ?? ''))}</t></is></c>`
}

function sheetXml(sheet: WriterSheet): string {
  const rows = new Map<number, string[]>()
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const [row, col] = key.split(',').map(Number)
    if (!rows.has(row)) rows.set(row, [])
    rows.get(row)!.push(cellXml(row, col, cell))
  }
  const sheetData = [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([row, cells]) => `<row r="${row + 1}">${cells.join('')}</row>`)
    .join('')
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetData}</sheetData></worksheet>`
  )
}

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border/></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`

export async function writeXlsx(sheets: WriterSheet[]): Promise<Uint8Array> {
  const zip = new JSZip()

  const sheetOverrides = sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('')
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      sheetOverrides +
      `</Types>`,
  )
  zip.file(
    '_rels/.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`,
  )
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets>` +
      sheets
        .map(
          (s, i) =>
            `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
        )
        .join('') +
      `</sheets></workbook>`,
  )
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join('') +
      `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`,
  )
  zip.file('xl/styles.xml', STYLES_XML)
  sheets.forEach((sheet, i) => {
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sheet))
  })

  const out = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  return new Uint8Array(out)
}
