/**
 * Teleport API Utilities
 */

export interface TeleportApiConfig {
  baseUrl: string
  token?: string
}

export async function teleportRequest<T>(
  endpoint: string,
  config?: TeleportApiConfig
): Promise<T> {
  return {} as T
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export * from '../../shared/utils/teleport/api.js'
