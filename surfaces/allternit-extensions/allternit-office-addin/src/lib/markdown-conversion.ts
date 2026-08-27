/**
 * "View as Markdown" plumbing for the Office add-in taskpane.
 *
 * Reads the current document's bytes via Office.js `Document.getFileAsync`
 * and converts them through the gateway's anydoc proxy
 * (`POST /api/v1/office/engines/markdown`), mirroring the platform surface's
 * /markdown-preview view. Kept Office.js-free where possible so the fetch and
 * filename logic is unit-testable in vitest.
 */
import {
  buildGatewayHeaders,
  fetchWithTimeout,
  getGatewayApiBaseUrl,
} from './platform-gateway'

export interface MarkdownConversionResult {
  markdown: string
  format?: string
  title?: string
}

/** The OOXML extension a host's current document converts as. */
export function extensionForHost(host: string): string {
  switch (host) {
    case 'word':
      return 'docx'
    case 'excel':
      return 'xlsx'
    case 'powerpoint':
      return 'pptx'
    default:
      return 'docx'
  }
}

/** Filename used for conversion: the document URL's basename when known. */
export function filenameForConversion(host: string, documentUrl?: string | null): string {
  if (documentUrl) {
    try {
      const basename = decodeURIComponent(new URL(documentUrl).pathname.split('/').pop() ?? '')
      if (/\.[a-z0-9]+$/i.test(basename)) return basename
    } catch {
      // fall through to the synthetic name
    }
  }
  return `document.${extensionForHost(host)}`
}

/**
 * Convert raw office document bytes to GFM markdown via the gateway's anydoc
 * proxy. Throws an Error carrying the engine's mapped detail on 4xx/5xx.
 */
export async function convertBytesToMarkdown(
  bytes: Uint8Array,
  filename: string,
): Promise<MarkdownConversionResult> {
  const response = await fetchWithTimeout(`${getGatewayApiBaseUrl()}/office/engines/markdown`, {
    method: 'POST',
    headers: {
      ...buildGatewayHeaders(),
      'Content-Type': 'application/octet-stream',
      'x-office-filename': filename,
    },
    body: bytes as unknown as BodyInit,
    // Conversions of large decks/books can take longer than the default 8s.
    timeout: 30_000,
  })
  const payload = (await response.json().catch(() => null)) as
    | (Partial<MarkdownConversionResult> & { error?: string; detail?: string })
    | null
  if (!response.ok) {
    throw new Error(payload?.detail ?? payload?.error ?? `Markdown conversion failed (${response.status})`)
  }
  return {
    markdown: payload?.markdown ?? '',
    format: payload?.format,
    title: payload?.title,
  }
}

/**
 * Read the current document's bytes with Office.js (`getFileAsync`, sliced).
 * Rejects when no Office host is available (companion mode).
 */
export function readCurrentDocumentBytes(): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const document = typeof Office !== 'undefined' ? Office.context?.document : undefined
    if (!document?.getFileAsync) {
      reject(new Error('Office document access is unavailable in this host.'))
      return
    }
    document.getFileAsync(Office.FileType.Compressed, { sliceSize: 4 * 1024 * 1024 }, (result) => {
      if (result.status !== Office.AsyncResultStatus.Succeeded || !result.value) {
        reject(new Error(result.error?.message ?? 'Could not read the current document.'))
        return
      }
      const file = result.value
      const slices: Uint8Array[] = []
      const readSlice = (index: number): void => {
        if (index >= file.sliceCount) {
          file.closeAsync()
          const total = slices.reduce((sum, slice) => sum + slice.length, 0)
          const bytes = new Uint8Array(total)
          let offset = 0
          for (const slice of slices) {
            bytes.set(slice, offset)
            offset += slice.length
          }
          resolve(bytes)
          return
        }
        file.getSliceAsync(index, (sliceResult) => {
          if (sliceResult.status !== Office.AsyncResultStatus.Succeeded) {
            file.closeAsync()
            reject(new Error(sliceResult.error?.message ?? 'Could not read the current document.'))
            return
          }
          slices.push(new Uint8Array(sliceResult.value.data as ArrayBuffer))
          readSlice(index + 1)
        })
      }
      readSlice(0)
    })
  })
}
