/** Stub for @genoffice/electron-utils (Electron-only utilities). */

export function appMenuLabels(..._args: any[]): Record<string, string> { return {} }

export function contextMenuLabels(..._args: any[]): Record<string, string> { return {} }

export function installContextMenu(..._args: any[]): void {
  // no native context menu in the browser build
}

export function installNavigationGuard(..._args: any[]): void {
  // single-page browser surface — nothing to guard
}

export function safeExternalUrl(url: string, ..._rest: any[]): string | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

export async function fetchWithSsrfGuard(url: string, init?: RequestInit): Promise<Response> {
  // The SSRF guard exists for the privileged main process; the browser's
  // same-origin/CORS rules are the guard here.
  return fetch(url, init)
}
