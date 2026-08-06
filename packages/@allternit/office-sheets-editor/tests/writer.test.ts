import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { writeXlsx } from '../src/xlsx-writer'

describe('writeXlsx', () => {
  it('produces a workbook with values, formulas, and IronCalc-required styles', async () => {
    const bytes = await writeXlsx([
      {
        name: 'Data',
        cells: {
          '0,0': { value: 10 },
          '0,1': { formula: 'A1*6', value: 60 },
          '1,0': { value: 'hello' },
          '1,1': { value: true },
        },
      },
    ])
    const zip = await JSZip.loadAsync(bytes)

    const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
    expect(sheetXml).toContain('<c r="A1"><v>10</v></c>')
    expect(sheetXml).toContain('<c r="B1"><f>A1*6</f><v>60</v></c>')
    expect(sheetXml).toContain('t="inlineStr"')
    expect(sheetXml).toContain('hello')
    expect(sheetXml).toContain('<c r="B2" t="b"><v>1</v></c>')

    // IronCalc's importer indexes <cellStyles> unguarded — it must exist.
    const stylesXml = await zip.file('xl/styles.xml')!.async('string')
    expect(stylesXml).toContain('<cellStyles')

    const workbookXml = await zip.file('xl/workbook.xml')!.async('string')
    expect(workbookXml).toContain('name="Data"')
  })

  it('escapes XML special characters in strings and formulas', async () => {
    const bytes = await writeXlsx([
      { name: 'S', cells: { '0,0': { value: '<a>&"b"' }, '0,1': { formula: 'IF(A1>1,"x","y")', value: null } } },
    ])
    const zip = await JSZip.loadAsync(bytes)
    const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
    expect(sheetXml).toContain('&lt;a&gt;&amp;&quot;b&quot;')
    expect(sheetXml).toContain('<f>IF(A1&gt;1,&quot;x&quot;,&quot;y&quot;)</f>')
  })

  it('writes multiple sheets with distinct parts', async () => {
    const bytes = await writeXlsx([
      { name: 'One', cells: { '0,0': { value: 1 } } },
      { name: 'Two', cells: { '0,0': { value: 2 } } },
    ])
    const zip = await JSZip.loadAsync(bytes)
    expect(zip.file('xl/worksheets/sheet1.xml')).toBeTruthy()
    expect(zip.file('xl/worksheets/sheet2.xml')).toBeTruthy()
    const workbookXml = await zip.file('xl/workbook.xml')!.async('string')
    expect(workbookXml).toContain('name="One"')
    expect(workbookXml).toContain('name="Two"')
  })
})
