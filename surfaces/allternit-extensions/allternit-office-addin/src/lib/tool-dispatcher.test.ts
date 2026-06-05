import { describe, it, expect } from 'vitest'
import { validateToolCall, describeToolCall, buildToolCallCode } from './tool-dispatcher'
import type { ParsedToolCall } from './tool-schemas'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCall(name: string, args: Record<string, unknown>): ParsedToolCall {
  return { id: 'test-1', name, arguments: args }
}

// ── validateToolCall ─────────────────────────────────────────────────────────

describe('validateToolCall', () => {
  it('returns valid for unknown tools', () => {
    const result = validateToolCall(makeCall('excel_read_range', {}))
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('returns valid when all required args are present', () => {
    const result = validateToolCall(
      makeCall('excel_write_range', { address: 'A1:B2', values: [[1, 2]] }),
    )
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('flags missing required args', () => {
    const result = validateToolCall(makeCall('excel_write_range', { address: 'A1' }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing required argument: "values"')
  })

  it('flags empty string as missing', () => {
    const result = validateToolCall(
      makeCall('word_replace_text', { searchText: '', replacementText: 'foo' }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing required argument: "searchText"')
  })

  it('flags null as missing', () => {
    const result = validateToolCall(
      makeCall('excel_write_range', { address: 'A1', values: null }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing required argument: "values"')
  })

  it('validates multiple missing args', () => {
    const result = validateToolCall(makeCall('ppt_add_textbox', {}))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing required argument: "slideIndex"')
    expect(result.errors).toContain('Missing required argument: "text"')
  })
})

// ── describeToolCall ─────────────────────────────────────────────────────────

describe('describeToolCall', () => {
  it('describes excel_read_range', () => {
    expect(describeToolCall('excel_read_range', { address: 'A1:C3' })).toBe(
      'Read Excel range A1:C3',
    )
  })

  it('describes excel_read_range with formulas', () => {
    expect(describeToolCall('excel_read_range', { includeFormulas: true })).toBe(
      'Read Excel range used range (with formulas)',
    )
  })

  it('describes word_replace_text', () => {
    expect(
      describeToolCall('word_replace_text', {
        searchText: 'foo',
        replacementText: 'bar',
        replaceAll: true,
      }),
    ).toBe('Replace "foo" with "bar" in Word (all)')
  })

  it('describes ppt_add_textbox', () => {
    expect(describeToolCall('ppt_add_textbox', { slideIndex: 2 })).toBe(
      'Add text box to PowerPoint slide 2',
    )
  })

  it('falls back for unknown tools', () => {
    expect(describeToolCall('unknown_tool', {})).toBe('Run unknown_tool')
  })
})

// ── buildToolCallCode ────────────────────────────────────────────────────────

describe('buildToolCallCode', () => {
  // ── Excel ──────────────────────────────────────────────────────────────────

  it('generates excel_read_range for used range', () => {
    const code = buildToolCallCode(makeCall('excel_read_range', {}))
    expect(code).toContain('sheet.getUsedRange()')
    expect(code).toContain('range.load(["values"])')
    expect(code).toContain('return JSON.stringify(result)')
  })

  it('generates excel_read_range with formulas and number format', () => {
    const code = buildToolCallCode(
      makeCall('excel_read_range', { address: 'A1', includeFormulas: true, includeNumberFormat: true }),
    )
    expect(code).toContain('sheet.getRange("A1")')
    expect(code).toContain('range.load(["values", "formulas", "numberFormat"])')
    expect(code).toContain('result.formulas = range.formulas;')
    expect(code).toContain('result.numberFormat = range.numberFormat;')
  })

  it('generates excel_write_range', () => {
    const code = buildToolCallCode(
      makeCall('excel_write_range', { address: 'B2:C3', values: [['a', 'b'], ['c', 'd']] }),
    )
    expect(code).toContain('sheet.getRange("B2:C3")')
    expect(code).toContain('range.values = [["a","b"],["c","d"]]')
    expect(code).toContain('return "Written to B2:C3"')
  })

  it('generates excel_write_range with numberFormat', () => {
    const code = buildToolCallCode(
      makeCall('excel_write_range', {
        address: 'A1',
        values: [[100]],
        numberFormat: '$#,##0.00',
      }),
    )
    expect(code).toContain('range.numberFormat = "$#,##0.00"')
  })

  it('generates excel_create_chart', () => {
    const code = buildToolCallCode(
      makeCall('excel_create_chart', { dataAddress: 'A1:D10', title: 'Revenue' }),
    )
    expect(code).toContain('sheet.getRange("A1:D10")')
    expect(code).toContain('Excel.ChartType.columnClustered')
    expect(code).toContain('chart.title.text = "Revenue"')
  })

  it('generates excel_apply_format with all options', () => {
    const code = buildToolCallCode(
      makeCall('excel_apply_format', {
        address: 'A1:A10',
        numberFormat: '0.0%',
        fontColor: '#FF0000',
        fillColor: '#FFFF00',
        bold: true,
        autofitColumns: true,
      }),
    )
    expect(code).toContain('range.numberFormat = "0.0%"')
    expect(code).toContain('range.format.font.color = "#FF0000"')
    expect(code).toContain('range.format.fill.color = "#FFFF00"')
    expect(code).toContain('range.format.font.bold = true')
    expect(code).toContain('range.format.autofitColumns()')
  })

  // ── PowerPoint ─────────────────────────────────────────────────────────────

  it('generates ppt_write_slide_text', () => {
    const code = buildToolCallCode(
      makeCall('ppt_write_slide_text', { slideIndex: 1, title: 'Hello', body: 'World' }),
    )
    expect(code).toContain('context.presentation.slides.items[1]')
    expect(code).toContain('Hello')
    expect(code).toContain('World')
  })

  it('generates ppt_add_textbox', () => {
    const code = buildToolCallCode(
      makeCall('ppt_add_textbox', {
        slideIndex: 2,
        text: 'Summary',
        left: 100,
        top: 200,
        width: 300,
        height: 150,
      }),
    )
    expect(code).toContain('context.presentation.slides.items[2]')
    expect(code).toContain('Summary')
    expect(code).toContain('left: 100')
    expect(code).toContain('top: 200')
    expect(code).toContain('width: 300')
    expect(code).toContain('height: 150')
  })

  // ── Word ───────────────────────────────────────────────────────────────────

  it('generates word_replace_text with tracked changes', () => {
    const code = buildToolCallCode(
      makeCall('word_replace_text', {
        searchText: 'old',
        replacementText: 'new',
        useTrackedChanges: true,
        replaceAll: true,
      }),
    )
    expect(code).toContain('search("old"')
    expect(code).toContain('insertText("new", Word.InsertLocation.replace)')
    expect(code).toContain('trackAll')
  })

  it('generates word_insert_table', () => {
    const code = buildToolCallCode(
      makeCall('word_insert_table', {
        data: [['Header 1', 'Header 2'], ['Row 1', 'Value']],
      }),
    )
    expect(code).toContain('Header 1')
    expect(code).toContain('Header 2')
    expect(code).toContain('Row 1')
  })

  // ── String escaping ────────────────────────────────────────────────────────

  it('escapes quotes in string arguments', () => {
    const code = buildToolCallCode(
      makeCall('word_replace_text', {
        searchText: 'say "hello"',
        replacementText: 'say "goodbye"',
      }),
    )
    expect(code).toContain('say \\"hello\\"')
    expect(code).toContain('say \\"goodbye\\"')
  })

  it('escapes newlines in string arguments', () => {
    const code = buildToolCallCode(
      makeCall('ppt_set_notes', { slideIndex: 1, notes: 'Line 1\nLine 2' }),
    )
    expect(code).toContain('Line 1\\nLine 2')
  })

  // ── Error cases ────────────────────────────────────────────────────────────

  it('throws for unknown tool names', () => {
    expect(() => buildToolCallCode(makeCall('unknown_tool', {}))).toThrow(
      'Unknown tool: unknown_tool',
    )
  })
})
