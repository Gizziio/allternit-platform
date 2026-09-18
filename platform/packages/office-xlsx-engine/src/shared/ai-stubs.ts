/**
 * Structural stand-ins for the @genoffice/ai-provider types referenced by
 * desktop-api.ts. The Genspark-bound AI layer is intentionally not ported;
 * these keep the bridge types compiling. AI bridge methods reject at runtime.
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
export interface AiChatRequest {
  messages?: unknown[]
  [key: string]: unknown
}
export interface AiChatResponse {
  content?: string
  [key: string]: unknown
}
export interface AiStreamRequest {
  messages?: unknown[]
  [key: string]: unknown
}
export interface AiStreamChunk {
  type?: string
  [key: string]: unknown
}
export interface GenSparkAccountStatus {
  loggedIn: boolean
  [key: string]: unknown
}
