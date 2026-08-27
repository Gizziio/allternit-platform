import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addElement,
  createBlankPptx,
  insertBlankSlide,
  openPptx,
  savePptx,
  type OpenedPptx,
  type TextElement,
} from '@allternit/office-pptx-engine'
import PptxWorker from './pptx-worker.ts?worker'
import type { PptxWorkerRequest, PptxWorkerResponse } from './pptx-worker'
import { brandStyles, officeTheme, primaryButton, toolButton } from './office-theme'

/** One slide's editable text: one string per paragraph across its text elements. */
export interface SlideLines {
  lines: string[]
}

export interface SlidesEditorProps {
  initialTitle?: string
  initialSlides?: SlideLines[]
  /** When provided, opens this .pptx file on mount (e.g. from the office launcher's file handoff). Takes precedence over initialSlides. */
  initialFile?: { name: string; bytes: Uint8Array }
  onSave?: (slides: SlideLines[], title: string) => Promise<string> | string
}

const EMU = 914400
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

function textElements(opened: OpenedPptx | null, slideIndex: number): TextElement[] {
  const slide = opened?.deck.slides[slideIndex]
  if (!slide) return []
  return slide.elements.filter(
    (el): el is TextElement => (el.type === 'text' || el.type === 'shape') && !!el.text,
  )
}

function slideCount(opened: OpenedPptx | null): number {
  return opened?.deck.slides.length ?? 0
}

/** Extract every paragraph line on a slide, in element order. */
function extractLines(opened: OpenedPptx, slideIndex: number): string[] {
  const lines: string[] = []
  for (const el of textElements(opened, slideIndex)) {
    for (const para of el.text?.paragraphs ?? []) {
      const line = (para.runs ?? []).map((r) => r.text ?? '').join('').trim()
      if (line) lines.push(line)
    }
  }
  return lines
}

export function SlidesEditor({ initialTitle, initialSlides, initialFile, onSave }: SlidesEditorProps) {
  const [title, setTitle] = useState(initialTitle ?? 'Untitled presentation')
  const [status, setStatus] = useState('ready')
  const [ready, setReady] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  // Mutation counter: the deck model is edited in place; bump to re-render.
  const [, setRev] = useState(0)
  const openedRef = useRef<OpenedPptx | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const bump = () => setRev((r) => r + 1)

  useEffect(() => {
    document.title = title
  }, [title])

  useEffect(() => {
    let mounted = true
    const worker = new PptxWorker()
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<PptxWorkerResponse>) => {
      const msg = event.data
      if (msg.type === 'roundtrip-result') {
        setStatus(`worker roundtrip: ${msg.title} (${msg.originalSize} → ${msg.outputSize} bytes, changed=${msg.changed})`)
      } else if (msg.type === 'error') {
        setStatus(`worker error: ${msg.message}`)
      }
    }

    const source = initialFile
      ? Promise.resolve(initialFile.bytes)
      : createBlankPptx()
    source
      .then((bytes) => openPptx(bytes))
      .then((opened) => {
        if (!mounted) return
        // Seed from artifact-provided slides: one textbox per slide (skipped
        // when a file was opened — the file's own slides are the content).
        if (!initialFile && initialSlides?.length) {
          for (let i = 0; i < initialSlides.length; i += 1) {
            if (i > 0) insertBlankSlide(opened, i - 1)
            const slide = opened.deck.slides[i]
            if (!slide) continue
            addElement(slide, {
              kind: 'textbox',
              offset: { x: EMU * 0.75, y: EMU * 0.75, cx: EMU * 8, cy: EMU * 4 },
              paragraphs: initialSlides[i].lines.map((line) => ({ runs: [{ text: line }] })),
            })
          }
        }
        openedRef.current = opened
        setReady(true)
        if (initialFile) setStatus(`opened ${initialFile.name}: ${opened.deck.slides.length} slides`)
      })
      .catch((err) => setStatus(`load error: ${err.message}`))

    return () => {
      mounted = false
      workerRef.current?.terminate()
      workerRef.current = null
    }
    // initialSlides is the load-time seed; re-seeding happens via the
    // component `key` from the parent view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const editRun = useCallback(
    (el: TextElement, paraIndex: number, runIndex: number, value: string) => {
      const para = el.text?.paragraphs[paraIndex]
      const run = para?.runs?.[runIndex]
      if (!run) return
      run.text = value
      el.dirty = true
      bump()
    },
    [],
  )

  const addParagraph = useCallback((el: TextElement) => {
    el.text?.paragraphs.push({ runs: [{ text: '' }] })
    el.dirty = true
    bump()
  }, [])

  const addTextbox = useCallback(() => {
    const opened = openedRef.current
    const slide = opened?.deck.slides[slideIndex]
    if (!slide) return
    addElement(slide, {
      kind: 'textbox',
      offset: { x: EMU * 0.75, y: EMU * (1 + textElements(opened, slideIndex).length), cx: EMU * 8, cy: EMU },
      paragraphs: [{ runs: [{ text: '' }] }],
    })
    bump()
  }, [slideIndex])

  const addSlide = useCallback(() => {
    const opened = openedRef.current
    if (!opened) return
    const created = insertBlankSlide(opened, slideIndex)
    if (created) {
      setSlideIndex(slideIndex + 1)
      bump()
    } else {
      setStatus('add slide failed')
    }
  }, [slideIndex])

  const handleExport = useCallback(async () => {
    const opened = openedRef.current
    if (!opened) return
    setStatus('exporting…')
    try {
      const out = await savePptx(opened)
      const blob = new Blob([out as unknown as BlobPart], { type: PPTX_MIME })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title.replace(/\s+/g, '_')}.pptx`
      a.click()
      URL.revokeObjectURL(url)
      setStatus(`exported ${out.byteLength} bytes`)
    } catch (err) {
      setStatus(`export error: ${(err as Error).message}`)
    }
  }, [title])

  const handleOpenFile = useCallback(async (file: File) => {
    setStatus('opening file…')
    try {
      const buffer = new Uint8Array(await file.arrayBuffer())
      const opened = await openPptx(buffer)
      openedRef.current = opened
      setSlideIndex(0)
      setReady(true)
      bump()
      setStatus(`opened ${file.name}: ${opened.deck.slides.length} slides`)
    } catch (err) {
      setStatus(`open error: ${(err as Error).message}`)
    }
  }, [])

  const handleWorkerRoundtrip = useCallback(() => {
    setStatus('worker roundtrip running…')
    workerRef.current?.postMessage({ type: 'roundtrip-blank' } as PptxWorkerRequest)
  }, [])

  const handleSave = useCallback(async () => {
    const opened = openedRef.current
    if (!opened || !onSave) return
    setStatus('saving…')
    try {
      const slides: SlideLines[] = opened.deck.slides.map((_, i) => ({
        lines: extractLines(opened, i),
      }))
      const message = await onSave(slides, title)
      setStatus(message)
    } catch (err) {
      setStatus(`save failed: ${(err as Error).message}`)
    }
  }, [onSave, title])

  const els = ready ? textElements(openedRef.current, slideIndex) : []
  const count = slideCount(openedRef.current)

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={brandStyles.brand}>
          <span style={brandStyles.accent}>A://</span>
          <span style={brandStyles.wordmark}>LLTERNIT SLIDES</span>
        </div>
        <input
          style={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Presentation title"
        />
        <div style={styles.status} data-testid="slides-status">{status}</div>
        <input
          type="file"
          accept=".pptx"
          style={{ display: 'none' }}
          id="pptx-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleOpenFile(file)
          }}
        />
        <label htmlFor="pptx-file-input" style={toolButton}>
          Open .pptx
        </label>
        <button style={toolButton} onClick={handleWorkerRoundtrip}>
          Roundtrip in Worker
        </button>
        {onSave ? (
          <button style={toolButton} onClick={() => void handleSave()}>
            Save
          </button>
        ) : null}
        <button style={primaryButton} onClick={handleExport}>
          Export .pptx
        </button>
      </header>
      <div style={styles.body}>
        <nav style={styles.sidebar}>
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              style={{ ...styles.slideTab, ...(i === slideIndex ? styles.slideTabActive : {}) }}
              onClick={() => setSlideIndex(i)}
            >
              Slide {i + 1}
            </button>
          ))}
          <button style={styles.addSlideButton} onClick={addSlide}>
            + Slide
          </button>
        </nav>
        <main style={styles.editor}>
          {!ready ? (
            <div style={styles.placeholder}>loading deck…</div>
          ) : els.length === 0 ? (
            <div style={styles.placeholder}>No text on this slide yet.</div>
          ) : (
            els.map((el) => (
              <div key={el.id} style={styles.element}>
                {(el.text?.paragraphs ?? []).map((para, pi) => (
                  <input
                    key={pi}
                    style={styles.lineInput}
                    value={(para.runs ?? []).map((r) => r.text ?? '').join('')}
                    onChange={(e) => {
                      // Single-run editing: collapse to one run per paragraph.
                      const runs = para.runs ?? []
                      if (runs.length === 0) {
                        para.runs = [{ text: e.target.value }]
                        el.dirty = true
                        bump()
                      } else {
                        editRun(el, pi, 0, e.target.value)
                        for (let ri = 1; ri < runs.length; ri += 1) runs[ri].text = ''
                      }
                    }}
                    placeholder="Type a line…"
                  />
                ))}
                <button style={styles.smallButton} onClick={() => addParagraph(el)}>
                  + Line
                </button>
              </div>
            ))
          )}
          {ready ? (
            <button style={styles.addButton} onClick={addTextbox}>
              + Textbox
            </button>
          ) : null}
        </main>
      </div>
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
  body: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
  },
  sidebar: {
    width: 152,
    borderRight: `1px solid ${officeTheme.border}`,
    background: officeTheme.panel,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    overflowY: 'auto',
  },
  slideTab: {
    background: 'transparent',
    border: `1px solid ${officeTheme.border}`,
    borderRadius: officeTheme.radiusSm,
    padding: '9px 12px',
    color: officeTheme.textSecondary,
    fontFamily: officeTheme.sans,
    fontSize: 12.5,
    cursor: 'pointer',
    textAlign: 'left',
  },
  slideTabActive: {
    borderColor: officeTheme.accent,
    color: officeTheme.accent,
    background: officeTheme.accentSoft,
  },
  addSlideButton: {
    background: 'transparent',
    border: `1px dashed ${officeTheme.borderStrong}`,
    borderRadius: officeTheme.radiusSm,
    padding: '9px 12px',
    color: officeTheme.textTertiary,
    fontFamily: officeTheme.sans,
    fontSize: 12.5,
    cursor: 'pointer',
  },
  editor: {
    flex: 1,
    overflowY: 'auto',
    padding: '32px 40px 64px',
  },
  placeholder: { color: officeTheme.textTertiary, fontFamily: officeTheme.sans },
  element: {
    marginBottom: 16,
    padding: '16px 20px',
    background: officeTheme.card,
    border: `1px solid ${officeTheme.border}`,
    borderRadius: officeTheme.radius,
    maxWidth: 820,
  },
  lineInput: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${officeTheme.border}`,
    padding: '8px 4px',
    color: officeTheme.text,
    fontSize: 16,
    lineHeight: 1.5,
    fontFamily: officeTheme.sans,
    outline: 'none',
  },
  smallButton: {
    marginTop: 8,
    background: 'transparent',
    border: `1px dashed ${officeTheme.borderStrong}`,
    borderRadius: officeTheme.radiusSm,
    padding: '4px 10px',
    color: officeTheme.textTertiary,
    fontFamily: officeTheme.sans,
    cursor: 'pointer',
    fontSize: 12,
  },
  addButton: {
    marginTop: 8,
    maxWidth: 820,
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
