import { useCallback, useEffect, useRef, useState } from 'react'
import { buildBlankDocx, parseDocx, saveDocx, type SaveBlock } from '@allternit/office-docx-engine'
import { brandStyles, officeTheme, primaryButton, toolButton } from './office-theme'
import DocxWorker from './docx-worker.ts?worker'
import type { DocxWorkerRequest, DocxWorkerResponse } from './docx-worker'

export interface DocBlock {
  type: string
  text: string
}

export interface DocsEditorProps {
  initialTitle?: string
  /** When provided, seeds the editor blocks (instead of the blank docx) and overrides them whenever the reference changes. */
  initialBlocks?: DocBlock[]
  /** When provided, opens this .docx file on mount (e.g. from the office launcher's file handoff). Takes precedence over initialBlocks. */
  initialFile?: { name: string; bytes: Uint8Array }
  /**
   * When provided, shows a Save button. May return a status message to display
   * in the status line; a rejected promise is shown as `save failed: …`.
   */
  onSave?: (blocks: DocBlock[], title: string) => void | string | Promise<void | string>
}

export function DocsEditor({ initialTitle, initialBlocks, initialFile, onSave }: DocsEditorProps = {}) {
  const [title, setTitle] = useState(initialTitle ?? 'Untitled document')
  const [blocks, setBlocks] = useState<DocBlock[]>([])
  const [status, setStatus] = useState('ready')
  const templateRef = useRef<Uint8Array | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const initialBlocksRef = useRef<DocBlock[] | undefined>(initialBlocks)

  useEffect(() => {
    if (initialTitle) setTitle(initialTitle)
  }, [initialTitle])

  useEffect(() => {
    initialBlocksRef.current = initialBlocks
    if (initialBlocks) setBlocks(initialBlocks.map((b) => ({ ...b })))
  }, [initialBlocks])

  useEffect(() => {
    let mounted = true
    const worker = new DocxWorker()
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<DocxWorkerResponse>) => {
      const msg = event.data
      if (msg.type === 'roundtrip-result') {
        setStatus(`worker roundtrip: ${msg.title} (${msg.originalSize} → ${msg.outputSize} bytes, changed=${msg.changed})`)
      } else if (msg.type === 'error') {
        setStatus(`worker error: ${msg.message}`)
      }
    }
    const source = initialFile
      ? Promise.resolve(initialFile.bytes)
      : buildBlankDocx()
    source
      .then((bytes) => {
        if (!mounted) return
        templateRef.current = bytes
        return parseDocx(bytes)
      })
      .then((doc) => {
        if (!mounted || !doc) return
        // Skip seeding from the parsed doc when controlled blocks were supplied
        // (an initialFile always seeds from the file itself).
        if (initialBlocksRef.current && !initialFile) return
        setBlocks(
          doc.blocks
            .filter((b) => !b.hidden)
            .map((b) => ({
              type: b.type,
              text: b.runs?.map((r) => r.text).join('') ?? '',
            })),
        )
        if (initialFile) setStatus(`opened ${initialFile.name}: ${doc.blocks.length} blocks`)
      })
      .catch((err) => setStatus(`load error: ${err.message}`))
    return () => {
      mounted = false
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  const handleExport = useCallback(async () => {
    if (!templateRef.current) return
    setStatus('exporting…')
    try {
      const doc = await parseDocx(templateRef.current)
      const generated: SaveBlock[] = blocks
        .filter((b) => b.text.trim())
        .map((b) => ({
          kind: 'generated',
          block: { type: 'paragraph', runs: [{ text: b.text }] },
        }))
      const out = await saveDocx(doc, generated)
      const blob = new Blob([out as unknown as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title.replace(/\s+/g, '_')}.docx`
      a.click()
      URL.revokeObjectURL(url)
      setStatus(`exported ${out.byteLength} bytes`)
    } catch (err) {
      setStatus(`export error: ${(err as Error).message}`)
    }
  }, [blocks, title])

  const updateBlock = (index: number, text: string) => {
    setBlocks((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], text }
      return next
    })
  }

  const addBlock = () => setBlocks((prev) => [...prev, { type: 'paragraph', text: '' }])

  const handleWorkerRoundtrip = useCallback(() => {
    setStatus('worker roundtrip running…')
    workerRef.current?.postMessage({ type: 'roundtrip-blank' } as DocxWorkerRequest)
  }, [])

  const handleSave = useCallback(async () => {
    if (!onSave) return
    setStatus('saving…')
    try {
      const message = await onSave(blocks.map((b) => ({ ...b })), title)
      setStatus(message ?? `saved ${blocks.length} blocks`)
    } catch (err) {
      setStatus(`save failed: ${(err as Error).message}`)
    }
  }, [blocks, title, onSave])

  const handleFileRoundtrip = useCallback(async (file: File) => {
    setStatus('reading file…')
    const buffer = new Uint8Array(await file.arrayBuffer())
    setStatus('worker roundtrip running…')
    workerRef.current?.postMessage({ type: 'roundtrip-file', bytes: buffer } as DocxWorkerRequest)
  }, [])

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={brandStyles.brand}>
          <span style={brandStyles.accent}>A://</span>
          <span style={brandStyles.wordmark}>LLTERNIT DOCS</span>
        </div>
        <input
          style={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Document title"
        />
        <div style={styles.status} data-testid="docs-status">{status}</div>
        <input
          type="file"
          accept=".docx"
          style={{ display: 'none' }}
          id="docx-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFileRoundtrip(file)
          }}
        />
        <label htmlFor="docx-file-input" style={toolButton}>
          Roundtrip File
        </label>
        <button style={toolButton} onClick={handleWorkerRoundtrip}>
          Roundtrip in Worker
        </button>
        {onSave ? (
          <button style={toolButton} onClick={handleSave}>
            Save
          </button>
        ) : null}
        <button style={primaryButton} onClick={handleExport}>
          Export .docx
        </button>
      </header>
      <main style={styles.editor}>
        <div style={styles.page}>
          {blocks.map((block, i) => (
            <div key={i} style={styles.block}>
              <input
                style={styles.blockInput}
                value={block.text}
                onChange={(e) => updateBlock(i, e.target.value)}
                placeholder="Type a paragraph…"
              />
            </div>
          ))}
          <button style={styles.addButton} onClick={addBlock}>
            + Paragraph
          </button>
        </div>
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
  editor: {
    flex: 1,
    overflowY: 'auto',
    padding: '32px 40px 64px',
  },
  page: {
    maxWidth: 780,
    margin: '0 auto',
    background: officeTheme.card,
    border: `1px solid ${officeTheme.border}`,
    borderRadius: officeTheme.radius,
    padding: '36px 40px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
  },
  block: {
    marginBottom: 4,
  },
  blockInput: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderRadius: officeTheme.radiusSm,
    padding: '10px 12px',
    color: officeTheme.text,
    fontSize: 16,
    lineHeight: 1.65,
    fontFamily: officeTheme.sans,
    outline: 'none',
  },
  addButton: {
    marginTop: 12,
    background: 'transparent',
    border: `1px dashed ${officeTheme.borderStrong}`,
    borderRadius: officeTheme.radiusSm,
    padding: '10px 16px',
    color: officeTheme.textTertiary,
    fontFamily: officeTheme.sans,
    fontSize: 13,
    cursor: 'pointer',
    width: '100%',
  },
}
