/**
 * Document Sync — snapshot export + live apply-back between the open Office
 * document and the gateway-hosted officecli backend.
 *
 * Snapshot model: the live document is exported with Office.getFileAsync
 * (compressed OOXML, read in slices), uploaded to the gateway, and every
 * officecli command runs against that server-side copy. After any Office.js
 * mutation the snapshot is marked dirty and lazily re-synced before the next
 * officecli read (self-healing loop).
 *
 * Apply-back runs FIRST-PARTY here — not through the sandboxed code-executor —
 * because generated code is not trusted with whole-document replacement.
 */

import { getOfficeHost, type OfficeHostType } from './host-detector'
import { uploadDocument } from './officecli-client'

// ── Snapshot cache ───────────────────────────────────────────────────────────

export interface SnapshotState {
  officeDocUrl: string | null
  docId: string | null
  filename: string | null
  dirty: boolean
}

let snapshot: SnapshotState = {
  officeDocUrl: null,
  docId: null,
  filename: null,
  dirty: true,
}

/** Returns a copy of the current snapshot cache (never a live reference). */
export function getSnapshotState(): SnapshotState {
  return { ...snapshot }
}

/**
 * Marks the gateway snapshot stale. Call after any Office.js mutation of the
 * live document; the next ensureFreshSnapshot() re-uploads.
 */
export function markDirty(): void {
  snapshot.dirty = true
}

/** Resets the module-level snapshot cache. Exported for test isolation. */
export function resetDocumentSyncCache(): void {
  snapshot = { officeDocUrl: null, docId: null, filename: null, dirty: true }
}

function currentDocumentUrl(): string | null {
  if (typeof Office === 'undefined' || !Office.context?.document) return null
  return Office.context.document.url || null
}

// ── Base64 helpers (chunked — no spread of large arrays) ─────────────────────

/**
 * Converts bytes to base64 in 32 KiB chunks. Spreading a multi-MB Uint8Array
 * into String.fromCharCode would blow the engine's argument-count limit.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + CHUNK_SIZE)
    binary += String.fromCharCode.apply(null, chunk as unknown as number[])
  }
  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// ── Local file path (transport model 3) ──────────────────────────────────────

/**
 * Returns the on-disk path of the open document when Office reports a file://
 * URL, or null otherwise (cloud documents, unsaved files, no Office context).
 */
export function getLocalFilePath(): string | null {
  const url = currentDocumentUrl()
  if (!url || !url.startsWith('file://')) return null
  // file:///Users/x/doc.docx → /Users/x/doc.docx (one leading slash remains);
  // file:///C:/x/doc.docx → /C:/x/doc.docx → strip the slash for Windows drives
  let path = decodeURIComponent(url.slice('file://'.length))
  if (/^\/[A-Za-z]:[\\/]/.test(path)) {
    path = path.slice(1)
  }
  return path || null
}

// ── Office.getFileAsync plumbing ─────────────────────────────────────────────

function getWholeFile(): Promise<Office.File> {
  return new Promise((resolve, reject) => {
    // Positional-fileType overload: matches both the installed @types/office-js
    // signature and the runtime API (compressed = the real .docx/.xlsx/.pptx).
    Office.context.document.getFileAsync(
      Office.FileType.Compressed,
      (result: Office.AsyncResult<Office.File>) => {
        if (result.status === Office.AsyncResultStatus.Succeeded && result.value) {
          resolve(result.value)
        } else {
          reject(
            new Error(
              `Failed to export the document for officecli sync: ${result.error?.message ?? 'unknown error'}`,
            ),
          )
        }
      },
    )
  })
}

function getFileSlice(file: Office.File, index: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    file.getSliceAsync(index, (result: Office.AsyncResult<Office.Slice>) => {
      if (result.status === Office.AsyncResultStatus.Succeeded && result.value) {
        resolve(new Uint8Array(result.value.data as ArrayBuffer))
      } else {
        reject(
          new Error(
            `Failed to read document slice ${index}: ${result.error?.message ?? 'unknown error'}`,
          ),
        )
      }
    })
  })
}

function closeFile(file: Office.File): void {
  try {
    file.closeAsync(() => {
      // Best-effort close — nothing actionable on failure
    })
  } catch {
    // Ignore close errors
  }
}

function deriveFilename(host: OfficeHostType): string {
  const ext = host === 'excel' ? 'xlsx' : host === 'word' ? 'docx' : 'pptx'
  const url = currentDocumentUrl()
  if (url) {
    try {
      const lastSegment = url.split(/[?#]/)[0].split('/').filter(Boolean).pop()
      if (lastSegment) {
        const decoded = decodeURIComponent(lastSegment)
        if (/\.(docx|xlsx|pptx)$/i.test(decoded)) return decoded
      }
    } catch {
      // Fall through to the synthetic name
    }
  }
  return `document.${ext}`
}

// ── Snapshot sync ────────────────────────────────────────────────────────────

/**
 * Exports the live document (compressed OOXML, sliced) and uploads it to the
 * gateway. Caches the returned doc_id against the current document URL.
 */
export async function syncDocumentToGateway(): Promise<{ docId: string }> {
  if (typeof Office === 'undefined' || !Office.context?.document) {
    throw new Error(
      'Office.js is not available in this context — cannot sync a document snapshot to officecli.',
    )
  }
  const host = getOfficeHost()
  if (host === 'unknown') {
    throw new Error(
      'Document export is not supported in this Office host. officecli snapshot sync supports Excel, Word, and PowerPoint.',
    )
  }
  if (typeof Office.context.document.getFileAsync !== 'function') {
    throw new Error(
      'This Office host does not support document export (Office.getFileAsync). officecli snapshot sync is unavailable.',
    )
  }

  const file = await getWholeFile()
  try {
    const bytes = new Uint8Array(file.size)
    let offset = 0
    for (let i = 0; i < file.sliceCount; i++) {
      const slice = await getFileSlice(file, i)
      const chunk = slice.length > bytes.length - offset ? slice.subarray(0, bytes.length - offset) : slice
      bytes.set(chunk, offset)
      offset += chunk.length
    }

    const filename = deriveFilename(host)
    const upload = await uploadDocument(bytes, { filename, host })
    snapshot = { officeDocUrl: currentDocumentUrl(), docId: upload.doc_id, filename, dirty: false }
    return { docId: upload.doc_id }
  } finally {
    closeFile(file)
  }
}

/**
 * Returns a fresh snapshot doc_id, re-uploading only when the snapshot is
 * missing, dirty, or the open document changed.
 */
export async function ensureFreshSnapshot(): Promise<{ docId: string }> {
  const urlUnchanged = snapshot.officeDocUrl === currentDocumentUrl()
  if (snapshot.docId && !snapshot.dirty && urlUnchanged) {
    return { docId: snapshot.docId }
  }
  return syncDocumentToGateway()
}

// ── Apply-back (live document replacement) ───────────────────────────────────

function assertApiSetSupported(apiSet: string, minVersion: string, feature: string): void {
  if (typeof Office === 'undefined' || !Office.context?.requirements?.isSetSupported) {
    throw new Error(
      `${feature} requires ${apiSet} ${minVersion} or later, but Office.js is not available in this context.`,
    )
  }
  if (!Office.context.requirements.isSetSupported(apiSet, minVersion)) {
    throw new Error(
      `${feature} requires ${apiSet} ${minVersion} or later. Please update your Office application, or use officecli tools with target "snapshot" and download the result instead.`,
    )
  }
}

/**
 * Replaces the open document's content with edited bytes (first-party
 * Office.js, per host). `fetchBytes` is called lazily to download the modified
 * file from the gateway. Returns a human/model-readable confirmation.
 *
 * Round-trip caveat: host base64-insert APIs may drop artifacts that do not
 * round-trip (e.g. certain comments/tracked-changes state). The original
 * snapshot stays on the gateway for the session, so nothing is unrecoverable.
 */
export async function applyBackToLiveDocument(fetchBytes: () => Promise<Uint8Array>): Promise<string> {
  const host = getOfficeHost()
  const bytes = await fetchBytes()
  const base64 = bytesToBase64(bytes)

  switch (host) {
    case 'word': {
      // Document.insertFileFromBase64 ships in WordApi 1.1 (InsertLocation.replace
      // performs a whole-document replace).
      assertApiSetSupported('WordApi', '1.1', 'Applying an edited file back to Word')
      try {
        await Word.run(async (context) => {
          context.document.body.insertFileFromBase64(base64, Word.InsertLocation.replace)
          await context.sync()
        })
      } catch (err) {
        throw new Error(
          `Failed to replace the Word document content: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
      break
    }

    case 'excel': {
      // Workbook.insertWorksheetsFromBase64 ships in ExcelApi 1.1. A workbook
      // must always contain at least one sheet, so a temporary sheet keeps the
      // workbook valid while the originals are deleted.
      assertApiSetSupported('ExcelApi', '1.1', 'Applying an edited file back to Excel')
      try {
        await Excel.run(async (context) => {
          const sheets = context.workbook.worksheets
          sheets.load('items/name')
          await context.sync()
          const tempSheet = sheets.add('__allternit_tmp__')
          for (const sheet of sheets.items) {
            sheet.delete()
          }
          await context.sync()
          context.workbook.insertWorksheetsFromBase64(base64)
          await context.sync()
          tempSheet.delete()
          await context.sync()
        })
      } catch (err) {
        throw new Error(
          `Failed to replace the Excel workbook content: ${err instanceof Error ? err.message : String(err)}. ` +
            'The workbook may be in a partial state; the pre-edit snapshot is still on the gateway.',
        )
      }
      break
    }

    case 'powerpoint': {
      // Presentation.insertSlidesFromBase64 ships in PowerPointApi 1.2.
      assertApiSetSupported('PowerPointApi', '1.2', 'Applying an edited file back to PowerPoint')
      try {
        await PowerPoint.run(async (context) => {
          const slides = context.presentation.slides
          slides.load('items')
          await context.sync()
          for (const slide of slides.items) {
            slide.delete()
          }
          await context.sync()
          context.presentation.insertSlidesFromBase64(base64)
          await context.sync()
        })
      } catch (err) {
        throw new Error(
          `Failed to replace the PowerPoint deck content: ${err instanceof Error ? err.message : String(err)}. ` +
            'The presentation may be in a partial state; the pre-edit snapshot is still on the gateway.',
        )
      }
      break
    }

    default:
      throw new Error(
        'Applying an edited file back to the live document is not supported in this Office host. Supported hosts: Word, Excel, PowerPoint.',
      )
  }

  // Live document and gateway snapshot now hold the same bytes
  snapshot.dirty = false
  return `Replaced the open ${host} document with the edited file (${bytes.length} bytes).`
}
