import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  convertBytesToMarkdown,
  extensionForHost,
  filenameForConversion,
} from './markdown-conversion'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

function mockFetch(status: number, payload: unknown) {
  const calls: { url: string; init: RequestInit }[] = []
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch
  return calls
}

describe('markdown-conversion plumbing', () => {
  it('maps hosts to OOXML extensions', () => {
    expect(extensionForHost('word')).toBe('docx')
    expect(extensionForHost('excel')).toBe('xlsx')
    expect(extensionForHost('powerpoint')).toBe('pptx')
  })

  it('derives the conversion filename from the document URL', () => {
    expect(filenameForConversion('word', 'https://files.example.com/docs/Quarterly%20Report.docx')).toBe(
      'Quarterly Report.docx',
    )
    expect(filenameForConversion('excel', null)).toBe('document.xlsx')
    expect(filenameForConversion('powerpoint', 'not a url')).toBe('document.pptx')
  })

  it('posts bytes to the v1 engines markdown endpoint', async () => {
    const calls = mockFetch(200, { markdown: '# Hello', format: 'docx', title: 'Hello' })
    const bytes = new Uint8Array([1, 2, 3])
    const result = await convertBytesToMarkdown(bytes, 'report.docx')

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toMatch(/\/api\/v1\/office\/engines\/markdown$/)
    expect(calls[0].init.method).toBe('POST')
    const headers = calls[0].init.headers as Record<string, string>
    expect(headers['x-office-filename']).toBe('report.docx')
    expect(headers['Content-Type']).toBe('application/octet-stream')
    expect(result).toEqual({ markdown: '# Hello', format: 'docx', title: 'Hello' })
  })

  it('surfaces the mapped engine error detail', async () => {
    mockFetch(415, { error: 'unsupported format', code: 'unsupported', detail: 'no supported format' })
    await expect(convertBytesToMarkdown(new Uint8Array([1]), 'notes.txt')).rejects.toThrow('no supported format')
  })

  it('throws a generic error when the failure payload is not JSON', async () => {
    globalThis.fetch = (async () => new Response('nope', { status: 502 })) as unknown as typeof fetch
    await expect(convertBytesToMarkdown(new Uint8Array([1]), 'report.docx')).rejects.toThrow(
      'Markdown conversion failed (502)',
    )
  })
})
