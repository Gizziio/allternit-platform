import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  syncDocumentToGateway,
  ensureFreshSnapshot,
  applyBackToLiveDocument,
  markDirty,
  getSnapshotState,
  getLocalFilePath,
  bytesToBase64,
  base64ToBytes,
  resetDocumentSyncCache,
} from './document-sync'
import * as client from './officecli-client'

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('./officecli-client', () => ({
  uploadDocument: vi.fn(),
}))

const uploadDocumentMock = vi.mocked(client.uploadDocument)

// ── Office global mocks ──────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

const HOSTS = { Excel: 'Excel', Word: 'Word', PowerPoint: 'PowerPoint' }

function installOfficeGlobal(host: string, options: { url?: string; isSetSupported?: boolean } = {}) {
  ;(globalThis as any).Office = {
    context: {
      host,
      document: { url: options.url ?? '' },
      requirements: { isSetSupported: () => options.isSetSupported ?? true },
    },
    HostType: HOSTS,
    FileType: { Compressed: 'Compressed' },
    AsyncResultStatus: { Succeeded: 'succeeded', Failed: 'failed' },
  }
}

/** Installs a fake Office.context.document.getFileAsync returning `slices`. */
function installGetFileAsync(slices: Uint8Array[]) {
  const size = slices.reduce((sum, s) => sum + s.length, 0)
  ;(globalThis as any).Office.context.document.getFileAsync = (
    _options: unknown,
    callback: (result: unknown) => void,
  ) => {
    callback({
      status: 'succeeded',
      value: {
        size,
        sliceCount: slices.length,
        getSliceAsync(index: number, cb: (result: unknown) => void) {
          cb({ status: 'succeeded', value: { data: slices[index].buffer } })
        },
        closeAsync(cb?: (result: unknown) => void) {
          cb?.({ status: 'succeeded' })
        },
      },
    })
  }
}

afterEach(() => {
  delete (globalThis as any).Office
  delete (globalThis as any).Word
  delete (globalThis as any).Excel
  delete (globalThis as any).PowerPoint
})

beforeEach(() => {
  vi.clearAllMocks()
  resetDocumentSyncCache()
  uploadDocumentMock.mockResolvedValue({ ok: true, doc_id: 'doc-1', size: 5, format: 'docx' })
})

// ── Slice assembly + upload ──────────────────────────────────────────────────

describe('syncDocumentToGateway', () => {
  it('assembles slices in order and uploads the combined bytes', async () => {
    installOfficeGlobal('Word', { url: 'file:///Users/test/report.docx' })
    installGetFileAsync([new Uint8Array([1, 2]), new Uint8Array([3, 4]), new Uint8Array([5])])

    const result = await syncDocumentToGateway()

    expect(result).toEqual({ docId: 'doc-1' })
    expect(uploadDocumentMock).toHaveBeenCalledTimes(1)
    const [bytes, meta] = uploadDocumentMock.mock.calls[0]
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5])
    expect(meta).toEqual({ filename: 'report.docx', host: 'word' })
  })

  it('falls back to a synthetic filename for unsaved documents', async () => {
    installOfficeGlobal('Excel')
    installGetFileAsync([new Uint8Array([1])])

    await syncDocumentToGateway()
    expect(uploadDocumentMock.mock.calls[0][1].filename).toBe('document.xlsx')
  })

  it('throws a clear error when Office.js is unavailable', async () => {
    await expect(syncDocumentToGateway()).rejects.toThrow('Office.js is not available')
  })

  it('throws a clear error for unsupported hosts', async () => {
    installOfficeGlobal('Outlook')
    await expect(syncDocumentToGateway()).rejects.toThrow('not supported in this Office host')
  })

  it('surfaces getFileAsync errors', async () => {
    installOfficeGlobal('Word')
    ;(globalThis as any).Office.context.document.getFileAsync = (_o: unknown, cb: (r: unknown) => void) =>
      cb({ status: 'failed', error: { message: 'export denied' } })

    await expect(syncDocumentToGateway()).rejects.toThrow('export denied')
  })
})

// ── Dirty / resync caching ───────────────────────────────────────────────────

describe('ensureFreshSnapshot caching', () => {
  it('reuses the snapshot while clean and re-syncs after markDirty', async () => {
    installOfficeGlobal('Word', { url: 'file:///Users/test/report.docx' })
    installGetFileAsync([new Uint8Array([1])])
    uploadDocumentMock
      .mockResolvedValueOnce({ ok: true, doc_id: 'doc-1', size: 1, format: 'docx' })
      .mockResolvedValueOnce({ ok: true, doc_id: 'doc-2', size: 1, format: 'docx' })

    const first = await ensureFreshSnapshot()
    const second = await ensureFreshSnapshot()
    expect(first.docId).toBe('doc-1')
    expect(second.docId).toBe('doc-1')
    expect(uploadDocumentMock).toHaveBeenCalledTimes(1)

    markDirty()
    expect(getSnapshotState().dirty).toBe(true)

    const third = await ensureFreshSnapshot()
    expect(third.docId).toBe('doc-2')
    expect(uploadDocumentMock).toHaveBeenCalledTimes(2)
    expect(getSnapshotState().dirty).toBe(false)
  })

  it('re-syncs when the document URL changes', async () => {
    installOfficeGlobal('Word', { url: 'file:///Users/test/a.docx' })
    installGetFileAsync([new Uint8Array([1])])

    await ensureFreshSnapshot()
    ;(globalThis as any).Office.context.document.url = 'file:///Users/test/b.docx'
    await ensureFreshSnapshot()
    expect(uploadDocumentMock).toHaveBeenCalledTimes(2)
  })
})

// ── Base64 helpers ───────────────────────────────────────────────────────────

describe('base64 helpers', () => {
  it('encodes small arrays', () => {
    expect(bytesToBase64(new Uint8Array([104, 105]))).toBe('aGk=')
  })

  it('round-trips arrays larger than one chunk', () => {
    const bytes = new Uint8Array(100000)
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256
    const roundTripped = base64ToBytes(bytesToBase64(bytes))
    expect(roundTripped).toEqual(bytes)
  })
})

// ── Local file path ──────────────────────────────────────────────────────────

describe('getLocalFilePath', () => {
  it('parses file:// URLs', () => {
    installOfficeGlobal('Word', { url: 'file:///Users/test/my%20doc.docx' })
    expect(getLocalFilePath()).toBe('/Users/test/my doc.docx')
  })

  it('strips the leading slash on Windows drive paths', () => {
    installOfficeGlobal('Word', { url: 'file:///C:/Users/test/doc.docx' })
    expect(getLocalFilePath()).toBe('C:/Users/test/doc.docx')
  })

  it('returns null for non-file URLs and missing Office context', () => {
    installOfficeGlobal('Word', { url: 'https://contoso.sharepoint.com/doc.docx' })
    expect(getLocalFilePath()).toBeNull()
    delete (globalThis as any).Office
    expect(getLocalFilePath()).toBeNull()
  })
})

// ── Apply-back ───────────────────────────────────────────────────────────────

const tinyBytes = new Uint8Array([80, 75, 3, 4])
const fetchTinyBytes = async () => tinyBytes

describe('applyBackToLiveDocument', () => {
  it('replaces the Word body via insertFileFromBase64', async () => {
    installOfficeGlobal('Word')
    const insertSpy = vi.fn()
    ;(globalThis as any).Word = {
      InsertLocation: { replace: 'replace' },
      run: async (fn: (ctx: unknown) => Promise<void>) =>
        fn({ document: { body: { insertFileFromBase64: insertSpy } }, sync: async () => {} }),
    }
    markDirty()

    const confirmation = await applyBackToLiveDocument(fetchTinyBytes)

    expect(insertSpy).toHaveBeenCalledWith(bytesToBase64(tinyBytes), 'replace')
    expect(confirmation).toContain('Replaced the open word document')
    // Live doc and gateway snapshot now hold the same bytes
    expect(getSnapshotState().dirty).toBe(false)
  })

  it('replaces Excel sheets, keeping a temp sheet to satisfy the one-sheet rule', async () => {
    installOfficeGlobal('Excel')
    const deleteOriginal1 = vi.fn()
    const deleteOriginal2 = vi.fn()
    const deleteTemp = vi.fn()
    const insertSpy = vi.fn()
    const sheets = {
      items: [{ delete: deleteOriginal1 }, { delete: deleteOriginal2 }],
      load: vi.fn(),
      add: vi.fn(() => ({ delete: deleteTemp })),
    }
    ;(globalThis as any).Excel = {
      run: async (fn: (ctx: unknown) => Promise<void>) =>
        fn({ workbook: { worksheets: sheets, insertWorksheetsFromBase64: insertSpy }, sync: async () => {} }),
    }

    await applyBackToLiveDocument(fetchTinyBytes)

    expect(deleteOriginal1).toHaveBeenCalled()
    expect(deleteOriginal2).toHaveBeenCalled()
    expect(insertSpy).toHaveBeenCalledWith(bytesToBase64(tinyBytes))
    expect(deleteTemp).toHaveBeenCalled()
  })

  it('replaces PowerPoint slides via insertSlidesFromBase64', async () => {
    installOfficeGlobal('PowerPoint')
    const deleteSlide = vi.fn()
    const insertSpy = vi.fn()
    const slides = { items: [{ delete: deleteSlide }], load: vi.fn() }
    ;(globalThis as any).PowerPoint = {
      run: async (fn: (ctx: unknown) => Promise<void>) =>
        fn({ presentation: { slides, insertSlidesFromBase64: insertSpy }, sync: async () => {} }),
    }

    await applyBackToLiveDocument(fetchTinyBytes)

    expect(deleteSlide).toHaveBeenCalled()
    expect(insertSpy).toHaveBeenCalledWith(bytesToBase64(tinyBytes))
  })

  it('throws a model-readable error when the requirement set is unsupported', async () => {
    installOfficeGlobal('Word', { isSetSupported: false })
    const runSpy = vi.fn()
    ;(globalThis as any).Word = { run: runSpy }

    await expect(applyBackToLiveDocument(fetchTinyBytes)).rejects.toThrow('WordApi 1.1')
    expect(runSpy).not.toHaveBeenCalled()
  })

  it('throws when the host cannot apply back', async () => {
    await expect(applyBackToLiveDocument(fetchTinyBytes)).rejects.toThrow('not supported in this Office host')
  })
})
