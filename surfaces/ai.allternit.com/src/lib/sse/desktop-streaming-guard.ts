/**
 * Desktop Streaming Guard
 *
 * Detects SSE/stream URLs and uses native fetch instead of the desktop bridge
 * to avoid freezing the webview (Tauri/Electron).
 *
 * Inspired by OpenWork's desktop streaming guard.
 */

const STREAM_URL_RE = /\/(event|stream)(\b|\/|$|\?)/;
const SSE_ACCEPT = 'text/event-stream';

function isStreamingRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (STREAM_URL_RE.test(url)) return true;

  const accept =
    init?.headers && typeof init.headers === 'object'
      ? (init.headers as Record<string, string>)['Accept'] ||
        (init.headers as Record<string, string>)['accept']
      : undefined;

  return typeof accept === 'string' && accept.toLowerCase().includes(SSE_ACCEPT);
}

/**
 * Create a wrapped fetch that bypasses the desktop bridge for SSE requests.
 *
 * Usage:
 *   const fetch = createDesktopStreamingGuard(nativeFetch, desktopFetch);
 */
export function createDesktopStreamingGuard(
  nativeFetch: typeof window.fetch,
  desktopFetch: typeof window.fetch
): typeof window.fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    if (isStreamingRequest(input, init)) {
      // Use native fetch for SSE — bypasses Tauri/Electron HTTP plugin
      return nativeFetch(input, init);
    }
    return desktopFetch(input, init);
  }) as typeof window.fetch;
}

/**
 * Patch the global fetch if running inside a desktop webview.
 * Call once at app startup.
 */
export function installDesktopStreamingGuard(): void {
  if (typeof window === 'undefined') return;

  const isDesktop =
    (window as any).__TAURI__ !== undefined ||
    (window as any).__OPENWORK_ELECTRON__ !== undefined ||
    navigator.userAgent.includes('AllternitDesktop');

  if (!isDesktop) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (isStreamingRequest(input, init)) {
      return originalFetch(input, init);
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;

  console.log('[DesktopStreamingGuard] Installed SSE bypass for desktop webview');
}
