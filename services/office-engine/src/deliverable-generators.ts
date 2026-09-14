/**
 * Minimal OOXML generators (consumer-packaged Cowork P3.1): markdown →
 * .docx report / .xlsx sheet / .pptx deck. Deliberately small — headings,
 * paragraphs, bullet lists, and tables map to plain OOXML; the office
 * engines handle the rich round-trip on open. Each generator returns the
 * full zip bytes so the API can persist and serve finished deliverables.
 */

import JSZip from 'jszip'

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const NS_W =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
const NS_A =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface MdBlock {
  kind: 'h' | 'p' | 'li' | 'code' | 'table'
  level: number
  text: string
  rows?: string[][]
}

/** Tiny markdown subset: # headings, - bullets, ``` fences, | tables |, paragraphs. */
export function parseMarkdown(md: string): MdBlock[] {
  const blocks: MdBlock[] = []
  const lines = md.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++])
      i++
      blocks.push({ kind: 'code', level: 0, text: buf.join('\n') })
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({ kind: 'h', level: heading[1].length, text: heading[2].trim() })
      i++
      continue
    }
    if (/^\s*-\s+/.test(line)) {
      blocks.push({ kind: 'li', level: 0, text: line.replace(/^\s*-\s+/, '').trim() })
      i++
      continue
    }
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i]
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim())
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells)
        i++
      }
      blocks.push({ kind: 'table', level: 0, text: '', rows })
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }
    blocks.push({ kind: 'p', level: 0, text: line.trim() })
    i++
  }
  return blocks
}

function wParagraph(text: string, opts: { heading?: number; bullet?: boolean; mono?: boolean } = {}): string {
  const size = opts.heading ? 36 - opts.heading * 2 : 22
  const bold = opts.heading ? '<w:b/>' : ''
  const indent = opts.bullet ? '<w:ind w:left="360"/>' : ''
  const prefix = opts.bullet ? '• ' : ''
  const font = opts.mono ? '<w:rFonts w:ascii="Menlo" w:hAnsi="Menlo"/><w:color w:val="444444"/>' : ''
  return (
    `<w:p><w:pPr>${indent}</w:pPr><w:r><w:rPr>${bold}<w:sz w:val="${size}"/>${font}</w:rPr>` +
    `<w:t xml:space="preserve">${esc(prefix + text)}</w:t></w:r></w:p>`
  )
}

function contentTypes(overrides: Array<{ part: string; type: string }>): string {
  const items = overrides
    .map((o) => `<Override PartName="${o.part}" ContentType="${o.type}"/>`)
    .join('')
  return (
    `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>${items}</Types>`
  )
}

const ROOT_RELS =
  `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>'

/** markdown → .docx report bytes. */
export async function buildDocx(md: string, title: string): Promise<Uint8Array> {
  const blocks = parseMarkdown(md)
  const body = [
    wParagraph(title, { heading: 1 }),
    ...blocks.map((b) => {
      if (b.kind === 'h') return wParagraph(b.text, { heading: Math.min(b.level + 1, 6) })
      if (b.kind === 'li') return wParagraph(b.text, { bullet: true })
      if (b.kind === 'code') return wParagraph(b.text, { mono: true })
      if (b.kind === 'table') {
        const rows = (b.rows ?? [])
          .map(
            (row) =>
              `<w:tr>${row
                .map(
                  (cell) =>
                    `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>${wParagraph(cell)}</w:tc>`,
                )
                .join('')}</w:tr>`,
          )
          .join('')
        return `<w:tbl><w:tblPr><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
          .map((edge) => `<w:${edge} w:val="single" w:sz="4" w:color="BBBBBB"/>`)
          .join('')}</w:tblBorders></w:tblPr>${rows}</w:tbl>`
      }
      return wParagraph(b.text)
    }),
  ].join('')
  const document =
    `${XML_HEAD}<w:document ${NS_W}><w:body>${body}<w:sectPr/></w:body></w:document>`
  const zip = new JSZip()
  zip.file('[Content_Types].xml', contentTypes([
    { part: '/word/document.xml', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml' },
  ]))
  zip.file('_rels/.rels', ROOT_RELS)
  zip.file('word/document.xml', document)
  return zip.generateAsync({ type: 'uint8array' })
}

/** markdown → .xlsx sheet bytes (paragraphs/headings → rows; first table → grid). */
export async function buildXlsx(md: string, title: string): Promise<Uint8Array> {
  const blocks = parseMarkdown(md)
  const table = blocks.find((b) => b.kind === 'table')
  const texts = blocks.filter((b) => b.kind !== 'table')
  const cell = (ref: string, value: string, bold = false) =>
    `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is>` +
    (bold ? '' : '') + `</c>`
  let rowsXml = ''
  let rowIdx = 1
  rowsXml += `<row r="${rowIdx++}">${cell(`A${rowIdx - 1}`, title)}</row>`
  for (const b of texts) {
    const prefix = b.kind === 'li' ? '• ' : b.kind === 'h' ? `${'#'.repeat(b.level)} ` : ''
    rowsXml += `<row r="${rowIdx++}">${cell(`A${rowIdx - 1}`, prefix + b.text)}</row>`
  }
  if (table?.rows) {
    for (const row of table.rows) {
      const cells = row
        .map((value, col) => cell(`${String.fromCharCode(65 + col)}${rowIdx}`, value))
        .join('')
      rowsXml += `<row r="${rowIdx++}">${cells}</row>`
    }
  }
  const sheet =
    `${XML_HEAD}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${rowsXml}</sheetData></worksheet>`
  const zip = new JSZip()
  zip.file('[Content_Types].xml', contentTypes([
    { part: '/xl/workbook.xml', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml' },
    { part: '/xl/worksheets/sheet1.xml', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml' },
  ]))
  zip.file('_rels/.rels',
    `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
  zip.file('xl/workbook.xml',
    `${XML_HEAD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>')
  zip.file('xl/_rels/workbook.xml.rels',
    `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
  zip.file('xl/worksheets/sheet1.xml', sheet)
  return zip.generateAsync({ type: 'uint8array' })
}

/** markdown → .pptx deck bytes (each heading starts a slide; bullets follow). */
export async function buildPptx(md: string, title: string): Promise<Uint8Array> {
  const blocks = parseMarkdown(md)
  interface SlideDef {
    title: string
    bullets: string[]
  }
  const slides: SlideDef[] = [{ title, bullets: [] }]
  let seenHeading = false
  for (const b of blocks) {
    // The first heading rides on the title slide; subsequent h1/h2 start slides.
    if (b.kind === 'h' && b.level <= 2 && seenHeading) slides.push({ title: b.text, bullets: [] })
    else if (b.kind === 'h' && b.level <= 2) {
      seenHeading = true
      slides[0] = { title: b.text, bullets: [] }
    } else if (b.kind === 'li') slides.at(-1)!.bullets.push(b.text)
    else if (b.kind === 'p') slides.at(-1)!.bullets.push(b.text)
  }
  const slideXml = (s: SlideDef, idx: number) => {
    const bullets = s.bullets
      .map(
        (b, i) =>
          `<a:p><a:pPr lvl="0"/><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${esc(b)}</a:t></a:r></a:p>`,
      )
      .join('')
    return {
      name: `ppt/slides/slide${idx}.xml`,
      xml:
        `${XML_HEAD}<p:sld ${NS_A}><p:cSld><p:spTree>` +
        '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
        `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>` +
        `<p:spPr><a:xfrm><a:off x="457200" y="274320"/><a:ext cx="8229600" cy="822960"/></a:xfrm></p:spPr>` +
        `<p:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="en-US" sz="3600" b="1"/><a:t>${esc(s.title)}</a:t></a:r></a:p></p:txBody></p:sp>` +
        `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>` +
        `<p:spPr><a:xfrm><a:off x="457200" y="1249680"/><a:ext cx="8229600" cy="4114800"/></a:xfrm></p:spPr>` +
        `<p:txBody><a:bodyPr/>${bullets || '<a:p/>'}</p:txBody></p:sp>` +
        '</p:spTree></p:cSld><p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr></p:sld>',
    }
  }
  const deck = slides.map((s, i) => slideXml(s, i + 1))
  const overrides = [
    { part: '/ppt/presentation.xml', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml' },
    ...deck.map((_, i) => ({
      part: `/ppt/slides/slide${i + 1}.xml`,
      type: 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml',
    })),
  ]
  const slideIds = deck
    .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`)
    .join('')
  const rels =
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>' +
    deck.map((_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('')
  const masterXml =
    `${XML_HEAD}<p:sldMaster ${NS_A}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>` +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:sldMaster>'
  const zip = new JSZip()
  zip.file('[Content_Types].xml', contentTypes(overrides))
  zip.file('_rels/.rels',
    `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>')
  zip.file('ppt/presentation.xml',
    `${XML_HEAD}<p:presentation ${NS_A}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
    `<p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>`)
  zip.file('ppt/_rels/presentation.xml.rels',
    `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`)
  zip.file('ppt/slideMasters/slideMaster1.xml', masterXml)
  for (const slide of deck) zip.file(slide.name, slide.xml)
  return zip.generateAsync({ type: 'uint8array' })
}
