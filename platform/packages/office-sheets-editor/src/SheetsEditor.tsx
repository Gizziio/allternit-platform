import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readWorkbook, recalcWorkbook } from './api'
import { writeXlsx, type WriterSheet } from './xlsx-writer'
import { brandStyles, officeTheme, primaryButton, toolButton } from './office-theme'

export interface SheetGrid {
  name: string
  /** Dense rows of display text, used for artifact persistence. */
  rows: string[][]
}

export interface SheetsEditorProps {
  initialTitle?: string
  initialSheets?: SheetGrid[]
  /** When provided, opens this .xlsx file on mount via the office-engine gateway (e.g. from the office launcher's file handoff). Takes precedence over initialSheets. */
  initialFile?: { name: string; bytes: Uint8Array }
  onSave?: (sheets: SheetGrid[], title: string) => Promise<string> | string
}

interface CellState {
  /** Raw user input: literal text/number or '=formula'. */
  input: string
  /** Last computed display value (from recalc or file load). */
  computed?: string
}

interface SheetState {
  name: string
  /** Sparse map "row,col" (0-based) → cell. */
  cells: Record<string, CellState>
}

const MIN_ROWS = 24
const MIN_COLS = 8
const SLACK_ROWS = 12
const SLACK_COLS = 4
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function key(row: number, col: number): string {
  return `${row},${col}`
}

function columnName(index: number): string {
  let name = ''
  let n = index + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

function bounds(sheet: SheetState): { rows: number; cols: number } {
  let maxRow = 0
  let maxCol = 0
  for (const k of Object.keys(sheet.cells)) {
    const [r, c] = k.split(',').map(Number)
    maxRow = Math.max(maxRow, r)
    maxCol = Math.max(maxCol, c)
  }
  return {
    rows: Math.max(MIN_ROWS, maxRow + 1 + SLACK_ROWS),
    cols: Math.max(MIN_COLS, maxCol + 1 + SLACK_COLS),
  }
}

function toWriterSheets(sheets: SheetState[]): WriterSheet[] {
  return sheets.map((sheet) => {
    const cells: WriterSheet['cells'] = {}
    for (const [k, cell] of Object.entries(sheet.cells)) {
      if (!cell.input) continue
      if (cell.input.startsWith('=')) {
        const numeric = cell.computed != null ? Number(cell.computed) : NaN
        cells[k] = {
          formula: cell.input.slice(1),
          value: Number.isFinite(numeric) ? numeric : null,
        }
      } else if (cell.input !== '' && !Number.isNaN(Number(cell.input))) {
        cells[k] = { value: Number(cell.input) }
      } else {
        cells[k] = { value: cell.input }
      }
    }
    return { name: sheet.name, cells }
  })
}

function toGrids(sheets: SheetState[]): SheetGrid[] {
  return sheets.map((sheet) => {
    let maxRow = -1
    let maxCol = -1
    for (const k of Object.keys(sheet.cells)) {
      const [r, c] = k.split(',').map(Number)
      maxRow = Math.max(maxRow, r)
      maxCol = Math.max(maxCol, c)
    }
    const rows: string[][] = []
    for (let r = 0; r <= maxRow; r += 1) {
      const row: string[] = []
      for (let c = 0; c <= maxCol; c += 1) {
        const cell = sheet.cells[key(r, c)]
        row.push(cell ? (cell.computed ?? cell.input) : '')
      }
      rows.push(row)
    }
    return { name: sheet.name, rows }
  })
}

export function SheetsEditor({ initialTitle, initialSheets, initialFile, onSave }: SheetsEditorProps) {
  const [title, setTitle] = useState(initialTitle ?? 'Untitled workbook')
  const [status, setStatus] = useState('ready')
  const [sheets, setSheets] = useState<SheetState[]>(() => {
    if (initialSheets?.length) {
      return initialSheets.map((grid) => {
        const cells: Record<string, CellState> = {}
        grid.rows.forEach((row, r) => {
          row.forEach((text, c) => {
            if (text) cells[key(r, c)] = { input: text }
          })
        })
        return { name: grid.name, cells }
      })
    }
    return [{ name: 'Sheet1', cells: {} }]
  })
  const [sheetIndex, setSheetIndex] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = title
  }, [title])

  const sheet = sheets[sheetIndex]
  const { rows, cols } = useMemo(() => bounds(sheet ?? { name: '', cells: {} }), [sheet])

  // setCell reads the current sheet index via a ref so the callback identity
  // stays stable across sheet switches.
  const sheetIndexRef = useRef(sheetIndex)
  sheetIndexRef.current = sheetIndex

  const setCell = useCallback((row: number, col: number, input: string) => {
    setSheets((prev) => {
      const next = [...prev]
      const s = { ...next[sheetIndexRef.current] }
      s.cells = { ...s.cells }
      if (input === '') {
        delete s.cells[key(row, col)]
      } else {
        s.cells[key(row, col)] = { input }
      }
      next[sheetIndexRef.current] = s
      return next
    })
  }, [])

  const loadWorkbook = useCallback(async (bytes: Uint8Array, name: string) => {
    setStatus('reading workbook…')
    try {
      const read = await readWorkbook(bytes, name)
      const next: SheetState[] = read.map((s) => {
        const cells: Record<string, CellState> = {}
        for (const cell of s.cells) {
          const text = cell.formula ?? (cell.value == null ? '' : String(cell.value))
          if (!text) continue
          cells[key(cell.row, cell.column)] = {
            input: cell.formula ? (cell.formula.startsWith('=') ? cell.formula : `=${cell.formula}`) : text,
            computed: cell.value == null ? undefined : String(cell.value),
          }
        }
        return { name: s.name, cells }
      })
      if (next.length === 0) next.push({ name: 'Sheet1', cells: {} })
      setSheets(next)
      setSheetIndex(0)
      setStatus(`opened ${name}: ${next.length} sheet${next.length === 1 ? '' : 's'}`)
    } catch (err) {
      setStatus(`open error: ${(err as Error).message}`)
    }
  }, [])

  const handleOpenFile = useCallback(async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer())
    await loadWorkbook(bytes, file.name)
  }, [loadWorkbook])

  // Open a handed-off file on mount (office launcher).
  const initialFileRef = useRef(initialFile)
  useEffect(() => {
    if (initialFileRef.current) {
      void loadWorkbook(initialFileRef.current.bytes, initialFileRef.current.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRecalc = useCallback(async () => {
    setStatus('recalculating…')
    try {
      const bytes = await writeXlsx(toWriterSheets(sheets))
      const reads = sheets.map((s) => {
        const b = bounds(s)
        return {
          sheet: s.name,
          range: { startRow: 0, endRow: b.rows - 1, startColumn: 0, endColumn: b.cols - 1 },
        }
      })
      const results = await recalcWorkbook({ workbookBytes: bytes, edits: [], reads })
      setSheets((prev) => {
        const next = prev.map((s) => ({ ...s, cells: { ...s.cells } }))
        for (const cell of results) {
          const idx = next.findIndex((s) => s.name === cell.sheet)
          if (idx < 0) continue
          const k = key(cell.row, cell.column)
          const existing = next[idx].cells[k]
          if (!existing) continue
          existing.computed = cell.formatted
        }
        return next
      })
      setStatus(`recalculated ${results.length} cells`)
    } catch (err) {
      setStatus(`recalc error: ${(err as Error).message}`)
    }
  }, [sheets])

  const handleExport = useCallback(async () => {
    setStatus('exporting…')
    try {
      const out = await writeXlsx(toWriterSheets(sheets))
      const blob = new Blob([out as unknown as BlobPart], { type: XLSX_MIME })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title.replace(/\s+/g, '_')}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setStatus(`exported ${out.byteLength} bytes`)
    } catch (err) {
      setStatus(`export error: ${(err as Error).message}`)
    }
  }, [sheets, title])

  const handleSave = useCallback(async () => {
    if (!onSave) return
    setStatus('saving…')
    try {
      const message = await onSave(toGrids(sheets), title)
      setStatus(message)
    } catch (err) {
      setStatus(`save failed: ${(err as Error).message}`)
    }
  }, [onSave, sheets, title])

  const addSheet = useCallback(() => {
    setSheets((prev) => [...prev, { name: `Sheet${prev.length + 1}`, cells: {} }])
    setSheetIndex(sheets.length)
  }, [sheets.length])

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={brandStyles.brand}>
          <span style={brandStyles.accent}>A://</span>
          <span style={brandStyles.wordmark}>LLTERNIT SHEETS</span>
        </div>
        <input
          style={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Workbook title"
        />
        <div style={styles.status} data-testid="sheets-status">{status}</div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          style={{ display: 'none' }}
          id="xlsx-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleOpenFile(file)
          }}
        />
        <label htmlFor="xlsx-file-input" style={toolButton}>
          Open .xlsx
        </label>
        <button style={toolButton} onClick={() => void handleRecalc()}>
          Recalculate
        </button>
        {onSave ? (
          <button style={toolButton} onClick={() => void handleSave()}>
            Save
          </button>
        ) : null}
        <button style={primaryButton} onClick={() => void handleExport()}>
          Export .xlsx
        </button>
      </header>
      <div style={styles.tabs}>
        {sheets.map((s, i) => (
          <button
            key={i}
            style={{ ...styles.tab, ...(i === sheetIndex ? styles.tabActive : {}) }}
            onClick={() => setSheetIndex(i)}
          >
            {s.name}
          </button>
        ))}
        <button style={styles.addTab} onClick={addSheet}>
          + Sheet
        </button>
      </div>
      <main style={styles.gridWrap}>
        <table style={styles.grid}>
          <thead>
            <tr>
              <th style={styles.cornerCell} />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} style={styles.colHeader}>{columnName(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <th style={styles.rowHeader}>{r + 1}</th>
                {Array.from({ length: cols }, (_, c) => {
                  const cell = sheet?.cells[key(r, c)]
                  return (
                    <td key={c} style={styles.cell}>
                      <input
                        style={styles.cellInput}
                        value={cell ? cell.input : ''}
                        title={cell?.computed != null ? `= ${cell.computed}` : undefined}
                        onChange={(e) => setCell(r, c, e.target.value)}
                        aria-label={`${columnName(c)}${r + 1}`}
                      />
                      {cell?.computed != null && cell.input.startsWith('=') ? (
                        <span style={styles.computed}>{cell.computed}</span>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
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
  tabs: {
    display: 'flex',
    gap: 6,
    padding: '8px 24px',
    borderBottom: `1px solid ${officeTheme.border}`,
    background: officeTheme.panel,
  },
  tab: {
    background: 'transparent',
    border: `1px solid ${officeTheme.border}`,
    borderRadius: officeTheme.radiusSm,
    padding: '6px 14px',
    color: officeTheme.textSecondary,
    fontFamily: officeTheme.sans,
    fontSize: 12.5,
    cursor: 'pointer',
  },
  tabActive: {
    borderColor: officeTheme.accent,
    color: officeTheme.accent,
    background: officeTheme.accentSoft,
  },
  addTab: {
    background: 'transparent',
    border: `1px dashed ${officeTheme.borderStrong}`,
    borderRadius: officeTheme.radiusSm,
    padding: '6px 14px',
    color: officeTheme.textTertiary,
    fontFamily: officeTheme.sans,
    fontSize: 12.5,
    cursor: 'pointer',
  },
  gridWrap: { flex: 1, overflow: 'auto', padding: 16 },
  grid: { borderCollapse: 'collapse' },
  cornerCell: { minWidth: 40 },
  colHeader: {
    color: officeTheme.textTertiary,
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 4px',
    borderBottom: `1px solid ${officeTheme.border}`,
    minWidth: 96,
  },
  rowHeader: {
    color: officeTheme.textTertiary,
    fontSize: 11,
    fontWeight: 500,
    padding: '0 8px',
    borderRight: `1px solid ${officeTheme.border}`,
    textAlign: 'right',
  },
  cell: {
    border: `1px solid ${officeTheme.border}`,
    padding: 0,
    position: 'relative',
  },
  cellInput: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    padding: '5px 8px',
    color: officeTheme.text,
    fontSize: 13,
    fontFamily: officeTheme.sans,
    outline: 'none',
  },
  computed: {
    position: 'absolute',
    right: 4,
    top: 4,
    color: officeTheme.accent,
    fontSize: 10,
    pointerEvents: 'none',
  },
}
