import { describe, it, expect } from 'vitest'
import { parseOutputMarkers } from './artifact-markers'

describe('parseOutputMarkers', () => {
  it('extracts a single artifact and strips it from the text', () => {
    const text = 'Screenshot ready (page 1)\n[artifact:{"doc_id":"d1","name":"p.png","kind":"png","url":"/api/v1/office/cli/document/d1/artifact/p.png"}]'
    const { artifacts, watches, cleanText } = parseOutputMarkers(text)
    expect(artifacts).toEqual([
      { doc_id: 'd1', name: 'p.png', kind: 'png', url: '/api/v1/office/cli/document/d1/artifact/p.png' },
    ])
    expect(watches).toEqual([])
    expect(cleanText).toBe('Screenshot ready (page 1)')
  })

  it('extracts watch markers', () => {
    const { watches } = parseOutputMarkers('Live preview started\n[watch:{"url":"http://127.0.0.1:26400"}]')
    expect(watches).toEqual([{ url: 'http://127.0.0.1:26400' }])
  })

  it('handles multiple artifacts in one output', () => {
    const text = '[artifact:{"doc_id":"a","name":"1.png","kind":"png","url":"u1"}]\n[artifact:{"doc_id":"a","name":"2.png","kind":"png","url":"u2"}]'
    const { artifacts, cleanText } = parseOutputMarkers(text)
    expect(artifacts).toHaveLength(2)
    expect(cleanText).toBe('')
  })

  it('tolerates malformed marker payloads', () => {
    const text = 'ok\n[artifact:{not json}]\n[artifact:{"doc_id":"d","name":"n","kind":"k","url":"u"}]'
    const { artifacts, cleanText } = parseOutputMarkers(text)
    expect(artifacts).toHaveLength(1)
    expect(cleanText).toBe('ok')
  })

  it('ignores artifact markers missing required fields', () => {
    const { artifacts } = parseOutputMarkers('[artifact:{"kind":"png"}]')
    expect(artifacts).toEqual([])
  })

  it('leaves ordinary text untouched', () => {
    const { artifacts, watches, cleanText } = parseOutputMarkers('Plain result [not-a-marker]')
    expect(artifacts).toEqual([])
    expect(watches).toEqual([])
    expect(cleanText).toBe('Plain result [not-a-marker]')
  })
})
