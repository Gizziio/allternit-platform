/**
 * Browser platform bridge for the vendored slides app.
 *
 * The vendored main process (src/main/slides-main.ts) registers its IPC
 * handlers against the electron shim's ipcMain registry; the vendored
 * preload maps window.slidesApi onto those handlers in-process. This module
 * boots that chain and overrides the file-IO channels with browser
 * implementations:
 *
 *   slides:open                  — file picker → memfs → original open-path
 *   slides:consume-pending-open  — host-injected bytes (artifact/launcher)
 *   slides:save / slides:save-as — engine save → memfs, then host onSave +
 *                                  download (save-as)
 */
import { Buffer } from 'buffer'
import { __ipcMainHandleRegistry, ipcMain, ipcRenderer } from './shims/electron'
import { readFile as memRead, writeFile as memWrite } from './shims/node-fs'
import { registerSlidesIpc } from './main/slides-main'
import { registerAiIpc, registerSlidesOnlyAiIpc } from './main/ai-ipc'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Electron {
    interface Rectangle { x: number; y: number; width: number; height: number }
    type MenuItemConstructorOptions = Record<string, unknown>
    type BrowserWindowConstructorOptions = Record<string, unknown>
  }
}

export interface SlidesInitialDocument {
  name: string
  bytes: Uint8Array
}

export interface SlidesBridgeOptions {
  document?: SlidesInitialDocument | null
  onSave?: (bytes: Uint8Array, name: string) => void
}

const VIRTUAL_UPLOADS = '/virtual/uploads'

async function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  return ipcRenderer.invoke(channel, ...args)
}

function pickPptxFile(): Promise<{ name: string; bytes: Uint8Array } | null> {
  return new Promise((resolvePromise) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pptx'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolvePromise(null)
      resolvePromise({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })
    }
    input.oncancel = () => resolvePromise(null)
    input.click()
  })
}

function download(bytes: Uint8Array, name: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

interface SaveResult {
  ok: boolean
  path?: string
  error?: string
}

let booted = false

export function installSlidesBridge(options: SlidesBridgeOptions = {}): void {
  if (booted) return
  booted = true

  registerSlidesIpc()
  registerAiIpc()
  registerSlidesOnlyAiIpc()

  // File open: picker → memfs → the original open-path handler.
  ipcMain.handle('slides:open', async (_e: unknown, fitWidthPx: number) => {
    const picked = await pickPptxFile()
    if (!picked) return null
    const path = `${VIRTUAL_UPLOADS}/${picked.name}`
    await memWrite(path, picked.bytes)
    return invoke('slides:open-path', path, fitWidthPx)
  })

  // Boot open: host-injected bytes (artifact / launcher handoff).
  ipcMain.handle('slides:consume-pending-open', async (_e: unknown, fitWidthPx: number) => {
    if (!options.document) return null
    const path = `${VIRTUAL_UPLOADS}/${options.document.name}`
    await memWrite(path, options.document.bytes)
    return invoke('slides:open-path', path, fitWidthPx)
  })

  // Save flows: alias the originals, then wrap with byte extraction.
  for (const channel of ['slides:save', 'slides:save-as'] as const) {
    const original = __ipcMainHandleRegistry.get(channel)
    if (!original) continue
    const alias = `${channel}:inner`
    ipcMain.handle(alias, original)
    ipcMain.handle(channel, async (...args: unknown[]) => {
      const result = (await invoke(alias, ...args)) as SaveResult
      if (result?.ok && result.path) {
        try {
          const bytes = (await memRead(result.path)) as Uint8Array
          const name = result.path.split('/').pop() ?? 'deck.pptx'
          options.onSave?.(bytes, name)
          if (channel === 'slides:save-as') download(bytes, name)
        } catch {
          // memfs miss — the engine-side save already succeeded.
        }
      }
      return result
    })
  }

  // Project channels (chat history): in-memory no-ops.
  ipcMain.handle('project:resolveChat', () => ({ projectId: 'browser', chatId: 'local' }))
  ipcMain.handle('project:appendChat', () => null)
  ipcMain.handle('project:loadChat', () => [])
  ipcMain.handle('project:rebindChat', () => null)
  ipcMain.handle('project:list', () => [])
  ipcMain.handle('project:create', () => null)
  ipcMain.handle('project:rename', () => null)
  ipcMain.handle('project:delete', () => null)
  ipcMain.handle('project:moveFile', () => null)
  ipcMain.handle('project:timeline', () => [])
}
