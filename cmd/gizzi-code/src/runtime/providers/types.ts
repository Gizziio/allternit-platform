import type { Provider as SDK } from "ai"
import type { Credential, AuthStatus } from "@/runtime/auth/credentials"
import type { DiscoveredModel } from "@/runtime/models/cache"

/**
 * ProviderAdapter — high-level adapter for auth + model discovery.
 * Used by ModelSync to discover models from connected providers.
 */
export interface ProviderAdapter {
  id: string
  auth: {
    status(cred: Credential): Promise<AuthStatus>
  }
  models: {
    list(cred: Credential): Promise<DiscoveredModel[]>
  }
}

/**
 * Custom model getter — provider-specific logic for resolving a LanguageModelV2.
 * Used when a provider needs special model initialization (e.g. OpenAI responses API,
 * Bedrock region prefixing, GitLab agenticChat).
 */
export type CustomModelLoader = (sdk: any, modelID: string, options?: Record<string, any>) => Promise<any>

/**
 * Result returned by a provider loader function.
 * Determines whether a provider should be auto-enabled and provides
 * provider-specific options and model resolution logic.
 */
export interface ProviderLoaderResult {
  /** Whether to automatically enable this provider when credentials are available */
  autoload: boolean
  /** Provider-specific SDK initialization options */
  options?: Record<string, any>
  /** Custom model getter (if provider needs special model initialization) */
  getModel?: CustomModelLoader
}

/**
 * Provider loader function — called during state initialization to configure
 * a provider. Receives the provider info from models.dev and returns
 * configuration for SDK initialization.
 */
export type ProviderLoader = (provider: ProviderInfo) => Promise<ProviderLoaderResult>

/**
 * Minimal provider info passed to loaders.
 * Matches Provider.Info shape from provider.ts.
 */
export interface ProviderInfo {
  id: string
  name: string
  source: "env" | "config" | "custom" | "api"
  env: string[]
  key?: string
  options: Record<string, any>
  models: Record<string, any>
}
