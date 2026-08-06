/**
 * Thin pdf.js wrapper: document open, page render to canvas, text extraction.
 * Kept separate from the component so the pdf.js worker configuration lives
 * in exactly one place.
 */
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface PdfDocumentHandle {
  pageCount: number
  renderPage: (pageNumber: number, canvas: HTMLCanvasElement, scale: number) => Promise<void>
  pageText: (pageNumber: number) => Promise<string>
  destroy: () => Promise<void>
}

export async function openPdf(bytes: Uint8Array): Promise<PdfDocumentHandle> {
  const doc = await pdfjs.getDocument({ data: bytes }).promise

  return {
    pageCount: doc.numPages,

    async renderPage(pageNumber, canvas, scale) {
      const page = await doc.getPage(pageNumber)
      const viewport = page.getViewport({ scale })
      const outputScale = window.devicePixelRatio || 1
      canvas.width = Math.floor(viewport.width * outputScale)
      canvas.height = Math.floor(viewport.height * outputScale)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      const context = canvas.getContext('2d')
      if (!context) throw new Error('canvas 2d context unavailable')
      await page.render({
        canvas,
        viewport,
        ...(outputScale !== 1 ? { transform: [outputScale, 0, 0, outputScale, 0, 0] } : {}),
      }).promise
    },

    async pageText(pageNumber) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      return content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    },

    async destroy() {
      await doc.destroy()
    },
  }
}

/** Extract every page's text — used for artifact persistence and search. */
export async function extractAllText(handle: PdfDocumentHandle): Promise<string[]> {
  const pages: string[] = []
  for (let i = 1; i <= handle.pageCount; i += 1) {
    pages.push(await handle.pageText(i))
  }
  return pages
}
