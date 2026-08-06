// Ambient module declarations for asset imports (must stay a global script).
declare module '*.png' {
  const url: string
  export default url
}

declare module '*.md?raw' {
  const content: string
  export default content
}

/** Global Electron namespace types for vendored code that references
 * `Electron.*` without importing (upstream resolves these via the electron
 * package's ambient types). */
declare namespace Electron {
  interface IpcRendererEvent extends Record<string, unknown> {}
  interface Rectangle { x: number; y: number; width: number; height: number }
  type MenuItemConstructorOptions = Record<string, unknown>
  type BrowserWindowConstructorOptions = Record<string, unknown>
  interface MenuItem {
    id?: string
    label?: string
    click?: (...args: unknown[]) => void
    enabled?: boolean
    visible?: boolean
    type?: string
    submenu?: unknown
  }
  interface Menu {
    items: MenuItem[]
    popup: (...args: unknown[]) => void
  }
}

/** Runtime globals installed by install-globals.ts for the vendored main. */
declare var process: { env: Record<string, string | undefined>; platform?: string; pid?: number; argv: string[] }
declare var Buffer: typeof import('buffer').Buffer
declare var __dirname: string
declare var __filename: string
