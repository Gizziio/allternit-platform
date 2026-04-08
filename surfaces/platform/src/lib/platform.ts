/**
 * Platform detection and web proxy utilities.
 *
 * `isElectronShell()` — true when running inside the A2R Electron desktop app.
 * `getWebProxyUrl(url)` — returns a Terminal-Server-proxied URL suitable for
 *   embedding in an iframe (strips X-Frame-Options / CSP frame-ancestors).
 */

/**
 * Detect whether the current page is running inside the A2R Electron shell.
 *
 * Checks for the preload-exposed `window.allternitSidecar` bridge first, then
 * falls back to the classic `process.versions.electron` check.
 */
export function isElectronShell(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.allternitSidecar !== undefined ||
    (window as any).process?.versions?.electron !== undefined
  );
}

/**
 * Return a `/web-proxy`-prefixed URL that the Terminal Server (or Vite dev
 * proxy) will fetch server-side, stripping frame-blocking headers so the
 * content can be safely embedded in an iframe.
 */
export function getWebProxyUrl(url: string): string {
  return `/web-proxy?url=${encodeURIComponent(url)}`;
}
