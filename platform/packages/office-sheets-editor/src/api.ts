/**
 * Gateway client for the office-engine xlsx endpoints.
 *
 * Uses the platform's /api/* path so the same code works in the Vite dev
 * server (proxied to the gateway), in production, and in the Electron
 * desktop (where /api/* rides the allternit-api:// protocol).
 */

export interface SheetCellRecord {
  row: number
  column: number
  value?: string | number | boolean | null
  formula?: string
}

export interface ReadSheet {
  id: string
  name: string
  rowCount: number
  columnCount: number
  truncated: boolean
  cells: SheetCellRecord[]
}

export interface RecalcCellResult {
  sheet: string
  row: number
  column: number
  formatted: string
  number?: number | null
  isFormula: boolean
}

async function postBytes(path: string, bytes: Uint8Array, filename: string): Promise<Response> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'x-office-filename': filename, 'content-type': 'application/octet-stream' },
    body: bytes as unknown as BodyInit,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`${path} failed (${res.status}): ${detail.slice(0, 200)}`)
  }
  return res
}

export async function readWorkbook(bytes: Uint8Array, filename: string): Promise<ReadSheet[]> {
  const res = await postBytes('/api/office/xlsx/read', bytes, filename)
  const body = (await res.json()) as { sheets: ReadSheet[] }
  return body.sheets
}

function toBase64(bytes: Uint8Array): string {
  // Chunked: String.fromCharCode(...bytes) blows the call stack on large files.
  let binary = ''
  const CHUNK = 8192
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export async function recalcWorkbook(input: {
  workbookBytes: Uint8Array
  edits: { sheet: string; row: number; column: number; input: string }[]
  reads: { sheet: string; range: { startRow: number; endRow: number; startColumn: number; endColumn: number } }[]
}): Promise<RecalcCellResult[]> {
  const base64 = toBase64(input.workbookBytes)
  const res = await fetch('/api/office/xlsx/recalc', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      workbookBase64: base64,
      edits: input.edits,
      reads: input.reads,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`/api/office/xlsx/recalc failed (${res.status}): ${detail.slice(0, 200)}`)
  }
  const body = (await res.json()) as { cells?: RecalcCellResult[] }
  return body.cells ?? []
}
