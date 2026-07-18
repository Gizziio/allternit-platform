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

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export { appendSystemContext, logAPIPrefix, logContextMetrics, normalizeToolInput, normalizeToolInputForAPI, prependUserContext, splitSysPromptPrefix, toolToAPISchema } from "../shared/utils/api.js";
export type { CacheScope, SystemPromptBlock } from "../shared/utils/api.js";
