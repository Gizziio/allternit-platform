/**
 * Fetch Interceptor — injects Clerk JWT into all `/api/*` requests.
 *
 * This is a temporary bridge while migrating from Next.js API routes
 * to the Rust backend. It allows existing `fetch('/api/...')` calls
 * to work without modifying every call site.
 *
 * TODO: Remove once all call sites use apiFetch() or the API client.
 */

type WindowFetch = typeof window.fetch;

type DesktopSession = {
  userId: string;
  userEmail?: string;
  accessToken: string;
  expiresAt: number;
};

export function installFetchInterceptor(): void {
  if (typeof window === 'undefined') return
  if ((window as any).__allternitFetchInterceptorInstalled) return

  const originalFetch = window.fetch

  const interceptedFetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input.toString()

    const isApiRequest =
      typeof url === 'string' &&
      (url.startsWith('/api') ||
        url.startsWith('/viz') ||
        url.startsWith('/sandbox') ||
        url.startsWith('/vm-session') ||
        url.startsWith('/rails') ||
        url.startsWith('/stream') ||
        url.startsWith('/terminal') ||
        url.startsWith('/mcp') ||
        url.startsWith('/platform') ||
        url.startsWith('/metrics') ||
        url.startsWith('/alabs') ||
        url.startsWith('/cowork') ||
        url.startsWith('/webhooks') ||
        url.startsWith('/status') ||
        url.startsWith('/health'))

    if (!isApiRequest) {
      return originalFetch(input, init)
    }

    const headers = new Headers(init?.headers)
    const token = localStorage.getItem('allternit_token')
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    try {
      const session = await window.allternit?.auth?.getSession?.() as DesktopSession | null | undefined
      if (session?.accessToken && session?.userId) {
        if (!headers.has('X-Allternit-Desktop-Access-Token')) {
          headers.set('X-Allternit-Desktop-Access-Token', session.accessToken)
        }
        if (!headers.has('X-Allternit-User-Id')) {
          headers.set('X-Allternit-User-Id', session.userId)
        }
        if (session.userEmail && !headers.has('X-Allternit-User-Email')) {
          headers.set('X-Allternit-User-Email', session.userEmail)
        }
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${session.accessToken}`)
        }
      }
    } catch {
      // Ignore desktop session lookup failures and fall back to whatever
      // browser-local auth context is already present.
    }

    const isElectronShell =
      window.allternitSidecar !== undefined ||
      (window as any).process?.versions?.electron !== undefined
    if (isElectronShell && !headers.has('Authorization') && !headers.has('X-Allternit-Desktop-Access-Token')) {
      headers.set('X-Allternit-Desktop-Access-Token', 'desktop-dev-bootstrap')
      headers.set('X-Allternit-User-Id', 'desktop-dev-user')
      headers.set('X-Allternit-User-Email', 'desktop@allternit.local')
      headers.set('X-Allternit-User-Name', 'Desktop Dev User')
    }

    return originalFetch(input, {
      ...init,
      headers,
    })
  }

  window.fetch = Object.assign(interceptedFetch, originalFetch) as WindowFetch

  ;(window as any).__allternitFetchInterceptorInstalled = true
  console.debug('[FetchInterceptor] Installed for /api/* requests')
}
