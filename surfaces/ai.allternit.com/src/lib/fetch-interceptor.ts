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

    const token = localStorage.getItem('allternit_token')
    if (!token) {
      return originalFetch(input, init)
    }

    const headers = new Headers(init?.headers)
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
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
