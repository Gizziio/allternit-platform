/**
 * Browser platform bridge for the vendored sheets renderer.
 *
 * Implements `window.desktopApi` (the surface the upstream Electron preload
 * provides) on top of the Allternit gateway: workbook sessions live in the
 * office-engine service (`/api/office/xlsx/session/*`), saves return fresh
 * bytes which are also forwarded to the host's `onSave` (artifact
 * persistence) and offered as a download on manual Save As.
 */
import type {
  DesktopApi,
  MenuAction,
  WorkbookFile,
  WorkbookSaveRequest,
} from '@allternit/office-suite/xlsx'

export interface SheetsInitialDocument {
  name: string
  bytes: Uint8Array
}

export interface SheetsBridgeOptions {
  /** Opened automatically on boot (via the File→Open menu action). */
  document?: SheetsInitialDocument | null
  /** Receives persisted workbook bytes after every successful save. */
  onSave?: (bytes: Uint8Array, name: string) => void
}

const NOT_AVAILABLE = 'not available in this build'
const unavailable = (): Promise<never> => Promise.reject(new Error(NOT_AVAILABLE))

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 8192
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`${path} failed (${res.status}): ${detail.slice(0, 200)}`)
  }
  return (await res.json()) as T
}

function createEmitter<T extends (...args: never[]) => void>() {
  const handlers = new Set<T>()
  return {
    on(handler: T): () => void {
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
    emit(...args: Parameters<T>) {
      for (const handler of handlers) handler(...args)
    },
  }
}

export function createDesktopBridge(options: SheetsBridgeOptions = {}): DesktopApi {
  const menuActions = createEmitter<(action: MenuAction) => void>()
  const workbookRenamed = createEmitter<(name: string) => void>()
  const closeSaveRequests = createEmitter<() => void>()

  let pendingDoc = options.document ?? null

  async function openSession(name: string, bytes: Uint8Array): Promise<WorkbookFile> {
    return postJson<WorkbookFile>('/api/office/xlsx/session/open', {
      name,
      bytesBase64: toBase64(bytes),
    })
  }

  function pickFile(): Promise<{ name: string; bytes: Uint8Array } | null> {
    return new Promise((resolvePromise) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.xlsx,.xls,.csv'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return resolvePromise(null)
        resolvePromise({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })
      }
      input.oncancel = () => resolvePromise(null)
      input.click()
    })
  }

  const bridge: DesktopApi = {
    getLanguage: () => Promise.resolve('en'),
    onLanguageChanged: () => () => undefined,

    selectWorkbook: async () => {
      if (pendingDoc) {
        const doc = pendingDoc
        pendingDoc = null
        return openSession(doc.name, doc.bytes)
      }
      const picked = await pickFile()
      if (!picked) return null
      return openSession(picked.name, picked.bytes)
    },

    readWorkbookRange: (request) =>
      postJson('/api/office/xlsx/session/range', request),

    readWorkbookFormulas: (request) =>
      postJson('/api/office/xlsx/session/formulas', request),

    recalcWorkbook: (request) =>
      postJson('/api/office/xlsx/session/session-recalc', request),

    readWorkbookMedia: () => unavailable(),
    readPivotDefinition: () => unavailable(),
    readLocalImage: () => unavailable(),

    saveWorkbookEdits: async (request: WorkbookSaveRequest) => {
      const result = await postJson<{
        canceled: boolean
        file: WorkbookFile
        touchedEntries: readonly string[]
        bytesBase64: string
      }>('/api/office/xlsx/session/save', request)
      const bytes = fromBase64(result.bytesBase64)
      options.onSave?.(bytes, result.file.name)
      if (request.mode === 'save-as') {
        const blob = new Blob([bytes as unknown as BlobPart], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = result.file.name
        a.click()
        URL.revokeObjectURL(url)
      }
      return {
        canceled: false,
        file: result.file,
        touchedEntries: result.touchedEntries,
      } as unknown as Awaited<ReturnType<DesktopApi['saveWorkbookEdits']>>
    },

    writeWorkbookRecovery: () => Promise.resolve({ ok: false }),
    autoRenameWorkbook: () => Promise.resolve({ renamed: false }),
    exportPdf: () => unavailable(),
    closeWorkbook: (sessionId) =>
      postJson('/api/office/xlsx/session/close', { sessionId }).then(() => undefined),
    openExternal: (url) => {
      window.open(url, '_blank', 'noopener')
      return Promise.resolve()
    },

    onMenuAction: (callback) => menuActions.on(callback),
    onWorkbookRenamed: (callback) => workbookRenamed.on(callback),
    notifyPendingEdits: () => undefined,
    onCloseSaveRequest: (callback) => closeSaveRequests.on(callback),
    reportCloseSaveResult: () => undefined,
    consumeNewBlankWorkbook: () => Promise.resolve(false),

    getAiSettings: () => Promise.resolve({ provider: 'allternit', providers: { allternit: { model: 'default', apiKey: 'platform-managed' } } }),
    setAiSettings: () => Promise.resolve(),
    aiChat: () => unavailable(),
    aiStream: () => unavailable(),
    aiStreamCancel: () => Promise.resolve(),
    aiGskStatus: () => Promise.resolve({ loggedIn: false }),
    aiGskLogin: () => unavailable(),
    webSearch: () => unavailable(),
    onAiStream: () => () => undefined,

    pickAttachments: () => Promise.resolve(null),
    addAttachmentPaths: (paths) => Promise.resolve({ accepted: [], rejected: paths }),
    addPastedImage: () => unavailable(),
    readAttachment: () => unavailable(),
    readAttachmentImage: () => unavailable(),
    getPathForFile: (file) => file.name,
  }

  return Object.assign(bridge, {
    __fireMenuAction: (action: MenuAction) => menuActions.emit(action),
  })
}

export interface InstalledSheetsBridge {
  /** Drive the File menu programmatically (used to auto-open documents). */
  fireMenuAction(action: MenuAction): void
}

declare global {
  interface Window {
    readonly desktopApi: DesktopApi
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly projectApi?: {
      appendChat(args: any): Promise<any>
      resolveChat(args: any): Promise<{ projectId: string; chatId: string }>
      loadChat(args: any): Promise<any[]>
      rebindChat(args: any): Promise<any>
    }
    __allternitSheetsBridge?: InstalledSheetsBridge
  }
}

/**
 * Install the browser bridge as window.desktopApi and return host controls.
 * When an initial document is pending, the File→Open menu action is fired
 * after mount so the renderer opens it through its normal flow.
 */
export function installDesktopBridge(options: SheetsBridgeOptions = {}): InstalledSheetsBridge {
  const bridge = createDesktopBridge(options) as DesktopApi & {
    __fireMenuAction: (action: MenuAction) => void
  }
  const controls: InstalledSheetsBridge = {
    fireMenuAction: (action) => bridge.__fireMenuAction(action),
  }
  Object.assign(window, { desktopApi: bridge })
  window.__allternitSheetsBridge = controls
  if (options.document) {
    // Defer past the app's mount effects (menu subscription happens there).
    setTimeout(() => controls.fireMenuAction('open'), 1500)
  }
  return controls
}
