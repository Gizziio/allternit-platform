/**
 * Structural stand-ins for @genoffice/ai-provider types. The Genspark-bound
 * AI provider layer is not ported; the vendored UI only needs the types.
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
