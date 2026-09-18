import type {
  AiSettings,
  DesktopApi,
  MenuCommand,
  OpenFileResult,
  PickImageResult,
} from './shared/ipc'

/**
 * Browser implementation of the Electron `window.desktop` bridge the
 * vendored renderer was written against.
 *
 * Semantics differ from the desktop shell where the platform demands it:
 * - `openDocx` / `pickImage` use an `<input type="file">` picker.
 * - `saveDocx*` produce Blob downloads (autosaves are silent; the host's
 *   `onSave` callback always receives the bytes so the platform surface can
 *   persist artifacts itself).
 * - `exportPdf` / `printPdfBuffer` / `saveMergedPdf` report an error — the
 *   upstream PDF path renders through Electron's print pipeline.
 * - All AI methods reject: no AI provider ships in this build.
 */

/** a document the host wants the editor to open at boot */
export interface InitialDocument {
  /** file name shown in the title bar and used for downloads */
  name: string
  /** raw .docx bytes */
  bytes: ArrayBuffer | Uint8Array
}

export interface DesktopBridgeOptions {
  /** opened once via consumePendingOpenDocx at boot */
  document?: InitialDocument | null
  /** receives every persisted document version (autosave and manual) */
  onSave?: (bytes: Uint8Array, name: string) => void
}

const NOT_AVAILABLE = 'not available in this build'

const aiUnavailable = (): Promise<never> => Promise.reject(new Error(NOT_AVAILABLE))

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function toArrayBuffer(bytes: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (bytes instanceof ArrayBuffer) return bytes
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function downloadBlob(data: ArrayBuffer, name: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mime }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    // cancel (Esc) does not fire onchange in all browsers; window focus is the fallback
    window.addEventListener('focus', () => setTimeout(() => resolve(null), 400), { once: true })
    input.click()
  })
}

/** tiny event registry so subscriptions register/unsubscribe for real */
function createEmitter<H>(): {
  subscribe: (handler: H) => () => void
  emit: (handler: (h: H) => void) => void
} {
  const handlers = new Set<H>()
  return {
    subscribe: (handler) => {
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
    emit: (fn) => {
      for (const h of handlers) fn(h)
    },
  }
}

export function createDesktopBridge(options: DesktopBridgeOptions = {}): DesktopApi {
  let pendingDoc: OpenFileResult | null = null
  let pendingDocConsumed = false
  const onSave = options.onSave

  const menuCommands = createEmitter<(command: MenuCommand, payload?: string) => void>()
  const languageChanged = createEmitter<(lang: 'en') => void>()
  const openDocxEvents = createEmitter<(result: OpenFileResult) => void>()
  const renamedDocx = createEmitter<(paths: { oldPath: string; newPath: string }) => void>()
  const teardown = createEmitter<() => void>()
  const aiStream = createEmitter<(chunk: never) => void>()
  const closeCheck = createEmitter<() => void>()
  const closeSaveRequest = createEmitter<() => void>()

  const persist = async (
    name: string,
    data: ArrayBuffer,
    download: boolean,
  ): Promise<{ ok: boolean; path?: string; error?: string }> => {
    try {
      onSave?.(new Uint8Array(data), name)
      if (download) downloadBlob(data, name, DOCX_MIME)
      return { ok: true, path: name }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  return {
    getLanguage: async () => 'en',
    onLanguageChanged: languageChanged.subscribe,

    openDocx: async (): Promise<OpenFileResult | null> => {
      const file = await pickFile('.docx')
      if (!file) return null
      const data = await file.arrayBuffer()
      return { path: file.name, name: file.name, data, hash: await sha256Hex(data) }
    },
    // no filesystem in the browser: recent-file entries can never resolve
    openDocxPath: async () => null,
    consumePendingOpenDocx: async () => {
      if (pendingDocConsumed) return null
      pendingDocConsumed = true
      if (options.document) {
        const data = toArrayBuffer(options.document.bytes)
        pendingDoc = {
          path: options.document.name,
          name: options.document.name,
          data,
          hash: await sha256Hex(data),
        }
      }
      return pendingDoc
    },
    consumeNewBlankDoc: async () => !options.document,
    onOpenDocx: openDocxEvents.subscribe,
    onRenamedDocx: renamedDocx.subscribe,

    // manual saves download a copy; autosaves only notify the host callback
    saveDocx: async (path, data, auto) => persist(path.split(/[\\/]/).pop() ?? path, data, !auto),
    writeRecoveryCopy: async () => ({ ok: true }),
    onTeardown: teardown.subscribe,
    saveDocxAs: async (defaultName, data) => persist(defaultName, data, true),
    saveDocxNew: async (defaultName, data) => persist(defaultName, data, true),
    getRecentFiles: async () => [],

    pickImage: async (): Promise<PickImageResult | null> => {
      const file = await pickFile('image/png,image/jpeg,image/gif')
      if (!file) return null
      const data = new Uint8Array(await file.arrayBuffer())
      let binary = ''
      for (const byte of data) binary += String.fromCharCode(byte)
      const mime = (['image/png', 'image/jpeg', 'image/gif'] as const).find(
        (m) => m === file.type,
      )
      if (!mime) return null
      return { base64: btoa(binary), mime, name: file.name }
    },

    getAiSettings: async (): Promise<AiSettings> => ({
      provider: 'allternit',
      providers: { allternit: { model: 'default', apiKey: 'platform-managed' } } as AiSettings['providers'],
    }),
    setAiSettings: async () => {},

    print: async () => window.print(),
    exportPdf: async () => ({ ok: false, error: 'PDF export is not supported in the browser build' }),
    printPdfBuffer: async () => ({
      ok: false,
      error: 'PDF export is not supported in the browser build',
    }),
    saveMergedPdf: async () => ({
      ok: false,
      error: 'PDF export is not supported in the browser build',
    }),

    aiChat: aiUnavailable,
    aiStream: aiUnavailable,
    aiStreamCancel: async () => {},
    aiGskStatus: async () => ({ loggedIn: false }),
    aiGskLogin: aiUnavailable,
    webSearch: aiUnavailable,
    imageSearch: aiUnavailable,
    fetchImage: async () => null,

    pickAttachments: async () => null,
    addAttachmentPaths: async () => ({ accepted: [], rejected: [] }),
    addPastedImage: async () => ({ accepted: [], rejected: [] }),
    readAttachment: async () => ({ ok: false, error: NOT_AVAILABLE }),
    readAttachmentImage: async () => ({ ok: false, error: NOT_AVAILABLE }),
    // Electron resolves dropped Files to absolute paths; browsers cannot
    getPathForFile: (file) => file.name,

    openNewTab: async () => {},
    listDocsTabs: async () => [],
    focusDocsTab: async () => {},

    onAiStream: aiStream.subscribe,
    onMenuCommand: menuCommands.subscribe,
    onCloseCheck: closeCheck.subscribe,
    reportCloseCheck: () => {},
    onCloseSaveRequest: closeSaveRequest.subscribe,
    reportCloseSaveResult: () => {},
  }
}

/**
 * Install the browser bridge as `window.desktop`. Idempotent: a later call
 * replaces the previous bridge (new options win).
 */
export function installDesktopBridge(options: DesktopBridgeOptions = {}): DesktopApi {
  const bridge = createDesktopBridge(options)
  window.desktop = bridge
  // tells the renderer there is no native menu bar (File tab stays visible on macOS)
  ;(window as unknown as Record<string, unknown>).__allternitBrowserBridge = true
  return bridge
}
