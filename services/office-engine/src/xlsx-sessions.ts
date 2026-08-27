/**
 * Workbook session endpoints — the HTTP form of the GenOffice sheets app's
 * `window.desktopApi` workbook surface. The browser bridge in
 * @allternit/office-sheets-app maps 1:1 onto these routes.
 *
 * Sessions are in-memory: opening stages the bytes in a temp dir, opens a
 * sidecar session, and tracks the sheet-name mapping the save pipeline needs
 * (session.ts, ported from the upstream Electron main process).
 */
import { Hono } from 'hono'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  openWorkbookSession,
  writeWorkbookTo,
  type WorkbookSessionInfo,
  type XlsxSidecarClient,
} from '@allternit/office-xlsx-engine'
import { workbookSaveRequestSchema } from '@allternit/office-xlsx-engine/shared/desktop-api'

interface SessionEntry {
  dir: string
  info: WorkbookSessionInfo
}

export function createXlsxSessionRouter(getClient: () => XlsxSidecarClient | null): Hono {
  const app = new Hono()
  const infos = new Map<string, WorkbookSessionInfo>()
  const entries = new Map<string, SessionEntry>()

  const unavailable = (c: { json: (body: unknown, status: 503) => Response }) =>
    c.json({ error: 'xlsx_sidecar_unavailable', detail: 'sidecar binary not found' }, 503)

  /** POST /open — `{ name, bytesBase64 }` → WorkbookFile (session metadata). */
  app.post('/open', async (c) => {
    const client = getClient()
    if (!client) return unavailable(c)
    let payload: { name?: string; bytesBase64?: string }
    try {
      payload = await c.req.json()
    } catch {
      return c.json({ error: 'invalid JSON body' }, 400)
    }
    if (!payload.bytesBase64) return c.json({ error: 'expected { name, bytesBase64 }' }, 400)

    const dir = await mkdtemp(join(tmpdir(), 'office-engine-session-'))
    try {
      const path = join(dir, (payload.name ?? 'workbook.xlsx').replace(/[/\\]/g, '_'))
      await writeFile(path, Buffer.from(payload.bytesBase64, 'base64'))
      const file = await openWorkbookSession(client, path, infos)
      const info = infos.get(file.sessionId)
      if (!info) throw new Error('session info missing after open')
      entries.set(file.sessionId, { dir, info })
      return c.json(file)
    } catch (err) {
      await rm(dir, { recursive: true, force: true })
      return c.json({ error: 'open failed', detail: (err as Error).message }, 422)
    }
  })

  /** POST /range — `{ sessionId, sheetId, range }` → RangeResult */
  app.post('/range', async (c) => {
    const client = getClient()
    if (!client) return unavailable(c)
    const body = await c.req.json().catch(() => null)
    if (!body?.sessionId || !body?.sheetId || !body?.range) {
      return c.json({ error: 'expected { sessionId, sheetId, range }' }, 400)
    }
    if (!entries.has(body.sessionId)) return c.json({ error: 'unknown session' }, 404)
    try {
      return c.json(
        await client.readRange({ sessionId: body.sessionId, sheetId: body.sheetId, range: body.range }),
      )
    } catch (err) {
      return c.json({ error: 'read failed', detail: (err as Error).message }, 422)
    }
  })

  /** POST /formulas — `{ sessionId, sheetId }` → formula cells */
  app.post('/formulas', async (c) => {
    const client = getClient()
    if (!client) return unavailable(c)
    const body = await c.req.json().catch(() => null)
    if (!body?.sessionId || !body?.sheetId) {
      return c.json({ error: 'expected { sessionId, sheetId }' }, 400)
    }
    if (!entries.has(body.sessionId)) return c.json({ error: 'unknown session' }, 404)
    try {
      return c.json(await client.readFormulaCells({ sessionId: body.sessionId, sheetId: body.sheetId }))
    } catch (err) {
      return c.json({ error: 'read failed', detail: (err as Error).message }, 422)
    }
  })

  /** POST /session-recalc — `{ sessionId, edits, reads }` → recalculated cells */
  app.post('/session-recalc', async (c) => {
    const client = getClient()
    if (!client) return unavailable(c)
    const body = await c.req.json().catch(() => null)
    if (!body?.sessionId || !Array.isArray(body?.edits) || !Array.isArray(body?.reads)) {
      return c.json({ error: 'expected { sessionId, edits, reads }' }, 400)
    }
    const entry = entries.get(body.sessionId)
    if (!entry) return c.json({ error: 'unknown session' }, 404)
    try {
      return c.json(
        await client.recalcCells({ path: entry.info.path, edits: body.edits, reads: body.reads }),
      )
    } catch (err) {
      return c.json({ error: 'recalc failed', detail: (err as Error).message }, 422)
    }
  })

  /**
   * POST /save — WorkbookSaveRequest (+ `includeBytes`) → saved WorkbookFile.
   * Applies the edit set through the streaming gateway save, swaps the
   * session onto the saved file, and returns the fresh session metadata plus
   * the new file bytes (base64) so the host can persist/download them.
   */
  app.post('/save', async (c) => {
    const client = getClient()
    if (!client) return unavailable(c)
    let parsed: ReturnType<typeof workbookSaveRequestSchema.parse>
    try {
      parsed = workbookSaveRequestSchema.parse(await c.req.json())
    } catch (err) {
      return c.json({ error: 'invalid save request', detail: (err as Error).message }, 400)
    }
    const entry = entries.get(parsed.sessionId)
    if (!entry) return c.json({ error: 'unknown session' }, 404)

    try {
      const mutation = await writeWorkbookTo(client, entry.info, parsed, entry.info.path)
      // Swap the session onto the saved file so subsequent reads match disk.
      entries.delete(parsed.sessionId)
      await client.close(parsed.sessionId).catch(() => undefined)
      const file = await openWorkbookSession(client, entry.info.path, infos)
      const nextInfo = infos.get(file.sessionId)
      if (!nextInfo) throw new Error('session info missing after save')
      entries.set(file.sessionId, { dir: entry.dir, info: nextInfo })
      const bytes = await readFile(entry.info.path)
      return c.json({
        canceled: false,
        file,
        touchedEntries: mutation.touchedEntries,
        bytesBase64: bytes.toString('base64'),
      })
    } catch (err) {
      return c.json({ error: 'save failed', detail: (err as Error).message }, 422)
    }
  })

  /** POST /close — `{ sessionId }` → closes the sidecar session, drops temp files. */
  app.post('/close', async (c) => {
    const client = getClient()
    const body = await c.req.json().catch(() => null)
    if (!body?.sessionId) return c.json({ error: 'expected { sessionId }' }, 400)
    const entry = entries.get(body.sessionId)
    if (client) await client.close(body.sessionId).catch(() => undefined)
    infos.delete(body.sessionId)
    entries.delete(body.sessionId)
    if (entry) await rm(entry.dir, { recursive: true, force: true })
    return c.json({ ok: true })
  })

  return app
}
