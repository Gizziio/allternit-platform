/**
 * API Utilities
 */

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
}

export async function apiRequest<T>(
  url: string,
  options?: ApiRequestOptions
): Promise<T> {
  const response = await fetch(url, {
    method: options?.method || 'GET',
    headers: options?.headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })
  return response.json() as Promise<T>
}

export function prependUserContext(messages: unknown[], context: string): unknown[] {
  return messages
}

export function appendSystemContext(messages: unknown[], context: string): unknown[] {
  return messages
}
