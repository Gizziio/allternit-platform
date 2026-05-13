/**
 * apiFetch — drop-in replacement for fetch() that injects the Clerk JWT
 * automatically for `/api/*` requests.
 *
 * Use this for all new fetch calls to the Rust backend. Existing raw
 * `fetch('/api/...')` calls should be migrated gradually.
 */

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString()

  // Only inject auth for API requests
  const isApiRequest =
    typeof url === 'string' &&
    (url.startsWith('/api') || url.startsWith('/viz') || url.startsWith('/sandbox') ||
     url.startsWith('/vm-session') || url.startsWith('/rails') || url.startsWith('/stream') ||
     url.startsWith('/terminal') || url.startsWith('/mcp') || url.startsWith('/platform') ||
     url.startsWith('/metrics') || url.startsWith('/alabs') || url.startsWith('/cowork') ||
     url.startsWith('/webhooks') || url.startsWith('/status') || url.startsWith('/health'))

  if (!isApiRequest) {
    return fetch(input, init)
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('allternit_token') : null

  const headers = new Headers(init?.headers)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(input, {
    ...init,
    headers,
  })
}
