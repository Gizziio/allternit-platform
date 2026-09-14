import { describe, expect, test } from 'vitest'
import { buildDocx, buildPptx, buildXlsx, parseMarkdown } from '../src/deliverable-generators'
import JSZip from 'jszip'

const MD = `# Summary Report

## Findings

- Alpha is ahead of plan
- Beta slipped one week

| Area | Status |
| --- | --- |
| Alpha | green |
| Beta | yellow |

Done.`

describe('parseMarkdown', () => {
  test('headings, bullets, tables, paragraphs', () => {
    const blocks = parseMarkdown(MD)
    expect(blocks.filter((b) => b.kind === 'h').length).toBe(2)
    expect(blocks.filter((b) => b.kind === 'li').length).toBe(2)
    expect(blocks.filter((b) => b.kind === 'table')).toHaveLength(1)
    expect(blocks.some((b) => b.kind === 'p')).toBe(true)
  })
})

describe('buildDocx', () => {
  test('produces a valid docx zip with the content', async () => {
    const bytes = await buildDocx(MD, 'Weekly Summary')
    const zip = await JSZip.loadAsync(bytes)
    const document = await zip.file('word/document.xml')!.async('string')
    expect(document).toContain('Weekly Summary')
    expect(document).toContain('Alpha is ahead of plan')
    expect(document).toContain('<w:tbl>')
  })
})

describe('buildXlsx', () => {
  test('produces a valid xlsx zip with rows', async () => {
    const bytes = await buildXlsx(MD, 'Weekly Sheet')
    const zip = await JSZip.loadAsync(bytes)
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
    expect(sheet).toContain('Weekly Sheet')
    expect(sheet).toContain('Alpha is ahead of plan')
    expect(sheet).toContain('green')
  })
})

describe('buildPptx', () => {
  test('produces a valid pptx zip with one slide per heading', async () => {
    const bytes = await buildPptx(MD, 'Weekly Deck')
    const zip = await JSZip.loadAsync(bytes)
    const s1 = await zip.file('ppt/slides/slide1.xml')!.async('string')
    const s2 = await zip.file('ppt/slides/slide2.xml')!.async('string')
    expect(s1).toContain('Summary Report')
    expect(s2).toContain('Findings')
    expect(s2).toContain('Alpha is ahead of plan')
  })
})
