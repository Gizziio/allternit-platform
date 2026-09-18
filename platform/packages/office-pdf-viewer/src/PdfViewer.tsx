import { useCallback, useEffect, useRef, useState } from 'react'
import { extractAllText, openPdf, type PdfDocumentHandle } from './pdf'
import { brandStyles, officeTheme, primaryButton, toolButton } from './office-theme'

export interface PdfViewerProps {
  initialTitle?: string
  /** Text-only mode: page texts loaded from an artifact when no file is open. */
  initialPages?: string[]
  /** When provided, opens this .pdf file on mount (e.g. from the office launcher's file handoff). */
  initialFile?: { name: string; bytes: Uint8Array }
  onSave?: (pages: string[], title: string) => Promise<string> | string
}

const PDF_MIME = 'application/pdf'
const ZOOM_LEVELS = [0.75, 1, 1.25, 1.5, 2]

export function PdfViewer({ initialTitle, initialPages, initialFile, onSave }: PdfViewerProps) {
  const [title, setTitle] = useState(initialTitle ?? 'Untitled document')
  const [status, setStatus] = useState('ready')
  const [pageNumber, setPageNumber] = useState(1)
  const [pageCount, setPageCount] = useState(initialPages?.length ?? 0)
  const [zoom, setZoom] = useState(1)
  const [textPages, setTextPages] = useState<string[]>(initialPages ?? [])
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null)
  const docRef = useRef<PdfDocumentHandle | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    document.title = title
  }, [title])

  // Render the current page whenever the document, page, or zoom changes.
  useEffect(() => {
    const doc = docRef.current
    const canvas = canvasRef.current
    if (!doc || !canvas || pageNumber < 1 || pageNumber > doc.pageCount) return
    let cancelled = false
    doc
      .renderPage(pageNumber, canvas, zoom)
      .catch((err) => {
        if (!cancelled) setStatus(`render error: ${(err as Error).message}`)
      })
    return () => {
      cancelled = true
    }
  }, [pageNumber, zoom, fileBytes])

  useEffect(() => {
    return () => {
      void docRef.current?.destroy()
      docRef.current = null
    }
  }, [])

  const loadPdf = useCallback(async (bytes: Uint8Array, name: string) => {
    setStatus('opening pdf…')
    try {
      await docRef.current?.destroy()
      const doc = await openPdf(bytes)
      docRef.current = doc
      setFileBytes(bytes)
      setPageCount(doc.pageCount)
      setPageNumber(1)
      setStatus(`opened ${name}: ${doc.pageCount} page${doc.pageCount === 1 ? '' : 's'}`)
      const pages = await extractAllText(doc)
      setTextPages(pages)
    } catch (err) {
      setStatus(`open error: ${(err as Error).message}`)
    }
  }, [])

  const handleOpenFile = useCallback(async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer())
    await loadPdf(bytes, file.name)
  }, [loadPdf])

  // Open a handed-off file on mount (office launcher).
  const initialFileRef = useRef(initialFile)
  useEffect(() => {
    if (initialFileRef.current) {
      void loadPdf(initialFileRef.current.bytes, initialFileRef.current.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleExport = useCallback(() => {
    if (!fileBytes) {
      setStatus('export unavailable: open a .pdf file first')
      return
    }
    const blob = new Blob([fileBytes as unknown as BlobPart], { type: PDF_MIME })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/\s+/g, '_')}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    setStatus(`exported ${fileBytes.byteLength} bytes`)
  }, [fileBytes, title])

  const handleSave = useCallback(async () => {
    if (!onSave) return
    setStatus('saving…')
    try {
      const message = await onSave(textPages, title)
      setStatus(message)
    } catch (err) {
      setStatus(`save failed: ${(err as Error).message}`)
    }
  }, [onSave, textPages, title])

  const stepZoom = useCallback((dir: 1 | -1) => {
    setZoom((current) => {
      const idx = ZOOM_LEVELS.indexOf(current)
      const next = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, idx + dir))
      return ZOOM_LEVELS[next]
    })
  }, [])

  const viewingText = !fileBytes && textPages.length > 0

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={brandStyles.brand}>
          <span style={brandStyles.accent}>A://</span>
          <span style={brandStyles.wordmark}>LLTERNIT PDF</span>
        </div>
        <input
          style={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Document title"
        />
        <div style={styles.status} data-testid="pdf-status">{status}</div>
        <input
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          id="pdf-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleOpenFile(file)
          }}
        />
        <label htmlFor="pdf-file-input" style={toolButton}>
          Open .pdf
        </label>
        {onSave ? (
          <button style={toolButton} onClick={() => void handleSave()}>
            Save
          </button>
        ) : null}
        <button style={primaryButton} onClick={handleExport}>
          Export .pdf
        </button>
      </header>
      {pageCount > 0 ? (
        <div style={styles.toolbar}>
          <button
            style={styles.toolButton}
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </button>
          <span style={styles.pageIndicator} data-testid="pdf-page-indicator">
            {pageNumber} / {pageCount}
          </span>
          <button
            style={styles.toolButton}
            disabled={pageNumber >= pageCount}
            onClick={() => setPageNumber((p) => Math.min(pageCount, p + 1))}
          >
            Next →
          </button>
          <button style={styles.toolButton} onClick={() => stepZoom(-1)} aria-label="Zoom out">
            −
          </button>
          <span style={styles.pageIndicator}>{Math.round(zoom * 100)}%</span>
          <button style={styles.toolButton} onClick={() => stepZoom(1)} aria-label="Zoom in">
            +
          </button>
        </div>
      ) : null}
      <main style={styles.viewer}>
        {fileBytes ? (
          <canvas ref={canvasRef} data-testid="pdf-canvas" style={styles.canvas} />
        ) : viewingText ? (
          <div style={styles.textPage} data-testid="pdf-text-page">
            {textPages[pageNumber - 1] || '(empty page)'}
          </div>
        ) : (
          <div style={styles.placeholder}>Open a .pdf file to view it here.</div>
        )}
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    background: officeTheme.bg,
    fontFamily: officeTheme.sans,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 24px',
    borderBottom: `1px solid ${officeTheme.border}`,
    background: officeTheme.panel,
  },
  titleInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    borderRadius: officeTheme.radiusSm,
    padding: '8px 12px',
    color: officeTheme.text,
    fontSize: 16,
    fontFamily: officeTheme.serif,
    outline: 'none',
  },
  status: {
    color: officeTheme.textTertiary,
    fontSize: 12,
    fontFamily: officeTheme.mono,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 24px',
    borderBottom: `1px solid ${officeTheme.border}`,
    background: officeTheme.panel,
  },
  toolButton: {
    background: 'transparent',
    border: `1px solid ${officeTheme.border}`,
    borderRadius: officeTheme.radiusSm,
    padding: '6px 12px',
    color: officeTheme.textSecondary,
    fontFamily: officeTheme.sans,
    fontSize: 12.5,
    cursor: 'pointer',
  },
  pageIndicator: {
    color: officeTheme.textTertiary,
    fontSize: 13,
    fontFamily: officeTheme.mono,
  },
  viewer: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    justifyContent: 'center',
    padding: 24,
  },
  canvas: {
    background: '#fff',
    borderRadius: 4,
    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    alignSelf: 'flex-start',
  },
  textPage: {
    maxWidth: 720,
    color: officeTheme.text,
    fontSize: 15,
    lineHeight: 1.7,
    fontFamily: officeTheme.sans,
    whiteSpace: 'pre-wrap',
  },
  placeholder: { color: officeTheme.textTertiary, alignSelf: 'center', fontFamily: officeTheme.sans },
}
