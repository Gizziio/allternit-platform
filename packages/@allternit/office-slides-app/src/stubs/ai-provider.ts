/**
 * Structural stand-ins for @genoffice/ai-provider. The Genspark-bound AI
 * provider layer is not ported; the vendored code needs the types and
 * signatures — every runtime entry point rejects.
 */

export interface AiSettings {
  provider: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providers: Record<string, any>
  model?: string
  apiKey?: string
  baseUrl?: string
  [key: string]: unknown
}

export type LegacyAiSettings = Partial<AiSettings>

export interface AiChatRequest {
  messages?: unknown[]
  [key: string]: unknown
}
export interface AiChatResponse {
  content?: string
  [key: string]: unknown
}
export interface AiStreamRequest {
  requestId: string
  settings: AiSettings
  system?: string
  messages: unknown[]
  tools?: unknown[]
  maxTokens?: number
  model?: string
  provider?: string
  [key: string]: unknown
}
export interface AiStreamChunk {
  type?: string
  text?: string
  error?: string
  toolCall?: unknown
  [key: string]: unknown
}
export interface GenSparkAccountStatus {
  loggedIn: boolean
  email?: string
  [key: string]: unknown
}

const NOT_AVAILABLE = 'AI is not available in this build'

export class AiCreditsError extends Error {
  constructor(message = NOT_AVAILABLE) {
    super(message)
    this.name = 'AiCreditsError'
  }
}

export class AiTimeoutError extends Error {
  constructor(message = NOT_AVAILABLE) {
    super(message)
    this.name = 'AiTimeoutError'
  }
}

export function defaultAiSettings(): AiSettings {
  return { provider: 'allternit', providers: { allternit: { model: 'default', apiKey: 'platform-managed' } } }
}

export function resolveAiSettings(...args: any[]): AiSettings {
  return { ...defaultAiSettings(), ...(args[0] ?? {}) }
}

export async function* streamForProvider(..._args: any[]): AsyncGenerator<AiStreamChunk> {
  throw new Error(NOT_AVAILABLE)
}

export type AiProviderId = string
export interface AiProviderConfig {
  model?: string
  apiKey?: string
  baseUrl?: string
  [key: string]: unknown
}
export interface AiProviderMeta {
  id: AiProviderId
  label: string
}
export const AI_PROVIDERS: AiProviderMeta[] = []
