import { describe, expect, it } from 'vitest'

import { composeDocumentContext } from './document-context'

describe('composeDocumentContext', () => {
  it('includes the bridge summary when present', () => {
    const result = composeDocumentContext({ bridgeSummary: 'Workbook: Q3.xlsx\nSheet: Data' })
    expect(result).toContain('Workbook: Q3.xlsx')
    expect(result).not.toContain('Document export')
  })

  it('omits empty sections', () => {
    expect(composeDocumentContext({ bridgeSummary: '' })).toBe('')
    expect(composeDocumentContext({ bridgeSummary: '   ' })).toBe('')
  })

  it('layers markdown export and snapshot note over the summary', () => {
    const result = composeDocumentContext({
      bridgeSummary: 'Summary',
      markdown: '# Deck\n\n- Slide 1',
      snapshotDocId: 'doc-123',
    })
    expect(result).toContain('Summary')
    expect(result).toContain('## Document export (markdown)')
    expect(result).toContain('- Slide 1')
    expect(result).toContain('doc-123')
    expect(result.indexOf('Summary')).toBeLessThan(result.indexOf('## Document export'))
  })

  it('truncates an oversized markdown export with a marker', () => {
    const result = composeDocumentContext({
      bridgeSummary: 'Summary',
      markdown: 'x'.repeat(20_000),
    })
    expect(result).toContain('[… document export truncated]')
    expect(result.length).toBeLessThan(24_000)
  })

  it('caps the total composed context', () => {
    const result = composeDocumentContext({
      bridgeSummary: 's'.repeat(20_000),
      markdown: 'm'.repeat(16_000),
      snapshotDocId: 'doc-9',
    })
    expect(result.length).toBeLessThan(24_100)
    expect(result).toContain('[… document context truncated]')
  })
})
