const CODE_PLATFORM_PATH = '/platform';

/** Open a Code session in a separate Electron window instead of the main app shell. */
export function openCodeSessionWindow(options: {
  sessionId: string;
  workspaceId?: string;
  title?: string;
}): void {
  if (window.allternit?.shell?.openSession) {
    void window.allternit.shell.openSession(options);
    return;
  }

  const url = new URL(CODE_PLATFORM_PATH, window.location.origin);
  url.searchParams.set('detachedSurface', 'code');
  url.searchParams.set('detachedSessionId', options.sessionId);
  if (options.workspaceId) url.searchParams.set('detachedWorkspaceId', options.workspaceId);
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}
