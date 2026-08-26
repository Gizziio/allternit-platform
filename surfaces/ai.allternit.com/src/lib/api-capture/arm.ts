/**
 * Cross-component signaling for "arm and start" API capture from the Site APIs
 * surface into the ACI browser.
 *
 * Problem: the Site APIs surface lives in the main platform canvas while the
 * capture trigger lives in the ACI browser top row. We need a tiny, surface-
 * agnostic way to say "open a browser tab and start recording for this domain".
 *
 * Implementation:
 * - `armBrowserCapture()` writes a short-lived arm record to sessionStorage and
 *   dispatches `allternit:open-view` to switch into browser mode.
 * - `useArmedBrowserCapture()` returns the pending arm record and a resolver.
 * - Browser capture UI (BrowserApiCaptureButton) calls `resolveBrowserCaptureArm()`
 *   once it consumes the signal, so the same arm request does not auto-start
 *   capture on every mount.
 *
 * This is intentionally small and synchronous; it does not require a backend
 * round-trip and works across web, desktop, and extension surfaces as long as
 * they share the same origin/sessionStorage context.
 */

const ARM_STORAGE_KEY = 'allternit:browser-capture-arm';
const ARM_MAX_AGE_MS = 30_000;

export interface BrowserCaptureArm {
  domain?: string;
  url?: string;
  requestedAt: number;
}

export interface ArmedCaptureState {
  arm: BrowserCaptureArm | null;
  resolve: () => void;
}

function readArm(): BrowserCaptureArm | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ARM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BrowserCaptureArm;
    if (Date.now() - parsed.requestedAt > ARM_MAX_AGE_MS) {
      window.sessionStorage.removeItem(ARM_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeArm(arm: BrowserCaptureArm): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ARM_STORAGE_KEY, JSON.stringify(arm));
  } catch {
    // ignore quota errors
  }
}

function clearArm(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(ARM_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Call from Site APIs (or any surface) to open the browser and auto-start
 * capture for the given domain/URL.
 */
export function armBrowserCapture(options: { domain?: string; url?: string }): void {
  const arm: BrowserCaptureArm = {
    ...options,
    requestedAt: Date.now(),
  };
  writeArm(arm);

  if (arm.url) {
    // Open a new browser tab to the requested URL. The browser's capture button
    // will consume the arm signal once the tab's domain matches.
    import('@/lib/openInBrowser').then(({ openInBrowser }) => {
      openInBrowser(arm.url!);
    });
  } else {
    window.dispatchEvent(
      new CustomEvent('allternit:open-view', {
        detail: { viewType: 'browser' },
      }),
    );
  }
}

/**
 * Returns the pending arm record (if any) and a function to consume it.
 * Safe to call during SSR.
 */
export function getArmedBrowserCapture(): ArmedCaptureState {
  return {
    arm: readArm(),
    resolve: clearArm,
  };
}

/**
 * Consume the pending arm record. Call after auto-starting capture.
 */
export function resolveBrowserCaptureArm(): void {
  clearArm();
}
