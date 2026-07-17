/**
 * Open a Code session in a separate window.
 *
 * In the Allternit Desktop shell this creates a new Electron BrowserWindow
 * (same mechanism as Design Studio). In a regular browser it opens a detached
 * popup so the session is not swallowed into a background tab.
 */
export function openCodeSessionWindow(options: {
  sessionId: string;
  workspaceId?: string;
  title?: string;
}): void {
  if (!options?.sessionId) {
    console.warn('[openCodeSessionWindow] No session id provided');
    return;
  }

  const isElectron = Boolean(window.allternit?.shell?.openSession);

  if (isElectron) {
    void window.allternit?.shell
      ?.openSession(options)
      ?.catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[openCodeSessionWindow] Electron bridge failed:', err);
        openDetachedCodeSessionPopup(options);
      });
    return;
  }

  openDetachedCodeSessionPopup(options);
}

function openDetachedCodeSessionPopup(options: {
  sessionId: string;
  workspaceId?: string;
  title?: string;
}): void {
  const url = new URL('/shell', window.location.origin);
  url.searchParams.set('detachedSurface', 'code');
  url.searchParams.set('detachedSessionId', options.sessionId);
  if (options.workspaceId) url.searchParams.set('detachedWorkspaceId', options.workspaceId);

  const width = 1180;
  const height = 820;
  const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
  const features = [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'resizable=yes',
    'scrollbars=yes',
    'status=yes',
    'toolbar=no',
    'menubar=no',
    'location=no',
  ].join(',');

  const target = `allternit-code-${options.sessionId}`;
  const popup = window.open(url.toString(), target, features);
  if (!popup || popup.closed) {
    // Popup was blocked; fall back to a new tab so the session is still reachable.
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }
}
