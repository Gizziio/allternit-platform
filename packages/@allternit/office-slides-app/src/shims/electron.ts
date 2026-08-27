/**
 * Browser shim for the Electron APIs the vendored slides main process uses.
 * The trick: `ipcMain.handle` calls are captured into a registry, and the
 * vendored preload's `ipcRenderer.invoke` resolves through it in-process —
 * the whole 118-channel slidesApi runs against the engine in the browser.
 *
 * Everything non-essential is a permissive no-op: signatures are variadic
 * and `any`-typed by design so vendored code compiles unchanged.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyFn = (...args: any[]) => any

const handleRegistry = new Map<string, AnyFn>()
const onRegistry = new Map<string, AnyFn[]>()

/** Direct access for the platform bridge's channel overrides. */
export const __ipcMainHandleRegistry = handleRegistry

function fakeEvent() {
  return { sender: fakeWebContents, senderFrame: null }
}

export const fakeWebContents: any = {
  id: 1,
  send: () => undefined,
  on: () => fakeWebContents,
  once: () => fakeWebContents,
  removeListener: () => fakeWebContents,
  isDestroyed: () => false,
  setWindowOpenHandler: () => undefined,
  onBeforeInputEvent: () => undefined,
  executeJavaScript: async () => undefined,
  getOSProcessId: () => 1,
  forcefullyCrashRenderer: () => undefined,
  reload: () => undefined,
  openDevTools: () => undefined,
  closeDevTools: () => undefined,
  getURL: () => '',
  getTitle: () => '',
  setAudioMuted: () => undefined,
}

export const ipcMain = {
  handle(channel: string, fn: AnyFn) {
    handleRegistry.set(channel, fn)
  },
  on(channel: string, fn: AnyFn) {
    const list = onRegistry.get(channel) ?? []
    list.push(fn)
    onRegistry.set(channel, list)
  },
  removeHandler(channel: string) {
    handleRegistry.delete(channel)
  },
}

export const ipcRenderer = {
  async invoke<T = any>(channel: string, ...args: any[]): Promise<T> {
    const fn = handleRegistry.get(channel)
    if (!fn) throw new Error(`No handler registered for ${channel}`)
    return fn(fakeEvent(), ...args) as T
  },
  send(channel: string, ...args: any[]) {
    for (const fn of onRegistry.get(channel) ?? []) fn(fakeEvent(), ...args)
  },
  on: (..._args: any[]) => ipcRenderer,
  removeListener: (..._args: any[]) => ipcRenderer,
}

export const contextBridge = {
  exposeInMainWorld: (_name: string, _api: unknown) => undefined,
}

export const webUtils = {
  getPathForFile: (file: File) => file.name,
}

export const app: any = {
  isPackaged: true,
  getPath: (_name: string) => '/virtual',
  getName: () => 'Allternit Slides',
  getVersion: () => '0.1.0',
  on: () => app,
  once: () => app,
  whenReady: async () => app,
  setAppUserModelId: () => undefined,
  commandLine: { appendSwitch: () => undefined },
  getAppMetrics: (): any[] => [],
  getGPUFeatureStatus: () => ({}),
  relaunch: () => undefined,
  quit: () => undefined,
}

export class BrowserWindow {
  webContents = fakeWebContents
  constructor(_options?: unknown) {}
  loadURL = async (..._args: any[]) => undefined
  loadFile = async (..._args: any[]) => undefined
  show() {}
  hide() {}
  focus() {}
  close() {}
  on(..._args: any[]) { return this }
  once(..._args: any[]) { return this }
  isDestroyed() { return false }
  setTitle(_t: string) {}
  destroy() {}
  setBounds(_b: unknown) {}
  getBounds() { return { x: 0, y: 0, width: 1280, height: 800 } }
  isSimpleFullScreen() { return false }
  setSimpleFullScreen(_v: boolean) {}
  setFullScreen(_v: boolean) {}
  isFullScreen() { return false }
  setAlwaysOnTop(_v: boolean, _level?: string) {}
  setVisibleOnAllWorkspaces(_v: boolean) {}
  static getAllWindows(): BrowserWindow[] { return [] }
  static fromWebContents(_wc: unknown): BrowserWindow | null { return null }
  static getFocusedWindow(): BrowserWindow | null { return null }
}

export class WebContentsView {
  webContents = fakeWebContents
  constructor(_options?: unknown) {}
  setBackgroundColor(_color: string) {}
}

export const dialog = {
  showMessageBox: async (..._args: any[]) => ({ response: 0, checkboxChecked: false }),
  showOpenDialog: async (..._args: any[]) => ({ canceled: true, filePaths: [] as string[] }),
  showSaveDialog: async (..._args: any[]) => ({ canceled: false, filePath: '/virtual/downloads/untitled.pptx' }),
}

export const shell = {
  openExternal: async (url: string) => {
    window.open(url, '_blank', 'noopener')
  },
  showItemInFolder: () => undefined,
}

export class Menu {
  items: unknown[] = []
  popup(): void {}
  static buildFromTemplate(..._args: any[]): Menu {
    return new Menu()
  }
  static setApplicationMenu(..._args: any[]): void {}
}

export const nativeTheme: any = { shouldUseDarkColors: true, on: () => nativeTheme }
export const screen: any = { getPrimaryDisplay: () => ({ workAreaSize: { width: 1440, height: 900 } }) }
export const globalShortcut = { register: () => true, unregisterAll: () => undefined }

export const clipboard: any = {
  writeText: () => undefined,
  readText: () => '',
  writeHTML: () => undefined,
  readHTML: () => '',
  has: () => false,
  read: () => '',
  write: () => undefined,
  availableFormats: () => [] as string[],
  clear: () => undefined,
}

export const nativeImage = {
  createThumbnailFromPath: async (_path: string, _size: unknown) => ({ isEmpty: () => true, getSize: () => ({ width: 0, height: 0 }), toPNG: () => new Uint8Array(), toDataURL: () => '' }),
  createFromDataURL: (_url: string) => ({ isEmpty: () => true, getSize: () => ({ width: 0, height: 0 }), toPNG: () => new Uint8Array(), toDataURL: () => '' }),
  createFromBuffer: (_buf: unknown) => ({ isEmpty: () => true, getSize: () => ({ width: 0, height: 0 }), toPNG: () => new Uint8Array(), toDataURL: () => '' }),
  createFromPath: (_path: string) => ({ isEmpty: () => true, getSize: () => ({ width: 0, height: 0 }), toPNG: () => new Uint8Array(), toDataURL: () => '' }),
}

export const desktopCapturer = {
  getSources: async (..._args: any[]) => [] as any[],
}

export const session = {
  defaultSession: {
    clearCache: async () => undefined,
    clearStorageData: async () => undefined,
    setDisplayMediaRequestHandler: (..._args: any[]) => undefined,
    resolveProxy: async (..._args: any[]) => '',
  },
}

export type IpcRendererEvent = Record<string, never>
export type WebContents = typeof fakeWebContents

