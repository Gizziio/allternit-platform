/**
 * Browser platform bridge for the vendored PDF app.
 *
 * The vendored pdf-main registers its IPC handlers against the electron
 * shim; the vendored preload maps window.pdfApi onto them in-process. This
 * module boots that chain and adds browser behaviors: host-injected
 * documents (artifact/launcher) granted into memfs, and save flows that
 * download + forward bytes to the host's onSave.
 */
import { __ipcMainHandleRegistry, ipcMain, ipcRenderer } from './shims/electron'
import { writeFile as memWrite, readFile as memRead } from './shims/node-fs'
import { createPdfView, registerPdfIpc } from './main/pdf-main'
import { AI_CHANNELS, PDF_CHANNELS, type PdfApi, type SavePdfResult } from './shared/ipc'
import { defaultAiSettings } from './stubs/ai-provider'

declare global {
  interface Window {
    pdfApi: PdfApi
  }
}

export interface PdfInitialDocument {
  name: string
  bytes: Uint8Array
}

export interface PdfBridgeOptions {
  document?: PdfInitialDocument | null
  onSave?: (bytes: Uint8Array, name: string) => void
  /** Force the viewer into read-only mode (no editing, no save). */
  readOnly?: boolean
}

const VIRTUAL_UPLOADS = '/virtual/uploads'

let booted = false
let bridgeReadOnly = false

export function isPdfBridgeReadOnly(): boolean {
  return bridgeReadOnly
}

function download(bytes: Uint8Array, name: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function installPdfBridge(options: PdfBridgeOptions = {}): void {
  if (booted) return
  booted = true
  bridgeReadOnly = options.readOnly ?? false

  registerPdfIpc()

  // AI settings: the OfficeAgentLoop streams through the host's
  // /api/agent-chat endpoint, but the vendored panel still reads settings
  // over IPC before each run — answer with the platform-managed config.
  ipcMain.handle(AI_CHANNELS.getSettings, () => defaultAiSettings())

  if (options.document) {
    // Inject lazily at consume time (the renderer calls consumePending on
    // mount): stage bytes in memfs, create the view (path grant + pending
    // open), then let the original handler return the pending path.
    const doc = options.document
    const original = __ipcMainHandleRegistry.get(PDF_CHANNELS.consumePending)
    if (original) {
      const alias = `${PDF_CHANNELS.consumePending}:inner`
      ipcMain.handle(alias, original)
      let injected = false
      ipcMain.handle(PDF_CHANNELS.consumePending, async (...args: unknown[]) => {
        if (!injected) {
          injected = true
          const path = `${VIRTUAL_UPLOADS}/${doc.name}`
          await memWrite(path, doc.bytes)
          createPdfView(path)
        }
        return ipcRenderer.invoke(alias, ...args)
      })
    } else {
      createPdfView(`${VIRTUAL_UPLOADS}/${doc.name}`)
    }
  } else {
    createPdfView()
  }

  // Wrap save: extract the saved bytes for the host (artifact save) and
  // trigger a download on explicit Save As.
  const original = __ipcMainHandleRegistry.get(PDF_CHANNELS.save)
  if (original) {
    const alias = `${PDF_CHANNELS.save}:inner`
    ipcMain.handle(alias, original)
    ipcMain.handle(PDF_CHANNELS.save, async (e: unknown, request: { path: string; targetPath?: string }) => {
      const result = (await ipcRenderer.invoke(alias, request)) as SavePdfResult & {
        targetPath?: string
      }
      if (result?.ok) {
        try {
          const target = request.targetPath ?? request.path
          const bytes = (await memRead(target)) as Uint8Array
          const name = target.split('/').pop() ?? 'document.pdf'
          options.onSave?.(bytes, name)
          if (request.targetPath && request.targetPath !== request.path) {
            download(bytes, name)
          }
        } catch {
          // memfs miss — save already succeeded engine-side.
        }
      }
      return result
    })
  }
}
