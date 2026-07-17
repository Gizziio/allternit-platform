import { AllternitHarness } from '@allternit/sdk/harness'
import type { HarnessConfig } from '@allternit/sdk'
import { Config } from '@/runtime/context/config/config'
import { Agent } from '@/runtime/loop/agent'
import {
  getHarnessConfig as getGlobalHarnessConfig,
  setHarnessConfig as setGlobalHarnessConfig,
  type HarnessConfig as MigrationHarnessConfig,
} from '../utils/migration'
import { getSessionIngressAuthHeaders } from '../utils/sessionIngressAuth'

export type { HarnessConfig }

/**
 * Normalize the legacy/global harness config stored by migration.ts into the
 * canonical SDK harness shape. The migration store uses a legacy BYOK layout
 * (byok.anthropic.apiKey) while the SDK uses byok.keys.{provider} and
 * byok.baseURLs.{provider}. Legacy 'mode' values of 'legacy' are rejected.
 */
function normalizeMigrationConfig(
  config: MigrationHarnessConfig | undefined,
): HarnessConfig | undefined {
  if (!config || config.mode === 'legacy') {
    return undefined
  }

  const normalized: HarnessConfig = { mode: config.mode }

  if (config.mode === 'byok' && config.byok) {
    normalized.byok = { keys: {}, baseURLs: {} }
    for (const provider of ['anthropic', 'openai', 'google'] as const) {
      const entry = config.byok[provider]
      if (entry?.apiKey) {
        normalized.byok.keys[provider] = entry.apiKey
      }
      const baseURL = (entry as { baseURL?: string } | undefined)?.baseURL
      if (baseURL) {
        normalized.byok.baseURLs = normalized.byok.baseURLs ?? {}
        normalized.byok.baseURLs[provider] = baseURL
      }
    }
    if (Object.keys(normalized.byok.keys).length === 0) {
      delete normalized.byok.keys
    }
    if (!normalized.byok.baseURLs || Object.keys(normalized.byok.baseURLs).length === 0) {
      delete normalized.byok.baseURLs
    }
  }

  if (config.mode === 'cloud' && config.cloud) {
    normalized.cloud = {
      baseURL: config.cloud.baseURL,
      accessToken: config.cloud.accessToken ?? '',
      ...(config.cloud.refreshToken && {
        refreshToken: config.cloud.refreshToken,
      }),
    }
  }

  if (config.mode === 'local' && config.local) {
    normalized.local = { baseURL: config.local.baseURL }
  }

  if (config.mode === 'subprocess' && config.subprocess) {
    normalized.subprocess = { command: config.subprocess.command }
  }

  return normalized
}

/**
 * Convert a canonical SDK harness config back to the migration storage shape.
 */
function denormalizeToMigrationConfig(
  config: HarnessConfig,
): MigrationHarnessConfig {
  const migration: MigrationHarnessConfig = { mode: config.mode }

  if (config.mode === 'byok' && config.byok) {
    migration.byok = {}
    for (const provider of ['anthropic', 'openai', 'google'] as const) {
      const apiKey = config.byok.keys?.[provider]
      const baseURL = config.byok.baseURLs?.[provider]
      if (apiKey || baseURL) {
        migration.byok[provider] = {
          ...(apiKey && { apiKey }),
          ...(baseURL && { baseURL }),
        }
      }
    }
  }

  if (config.mode === 'cloud' && config.cloud) {
    migration.cloud = {
      baseURL: config.cloud.baseURL,
      accessToken: config.cloud.accessToken,
      ...(config.cloud.refreshToken && {
        refreshToken: config.cloud.refreshToken,
      }),
    }
  }

  if (config.mode === 'local' && config.local) {
    migration.local = { baseURL: config.local.baseURL }
  }

  if (config.mode === 'subprocess' && config.subprocess) {
    migration.subprocess = { command: config.subprocess.command }
  }

  return migration
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function looksLikePlatformAgentId(value: string): boolean {
  return UUID_RE.test(value)
}

function getAllternitApiBase(): string {
  return (
    process.env.ALLTERNIT_API_URL ||
    process.env.ALLTERNIT_BASE_URL ||
    'http://127.0.0.1:8013'
  ).replace(/\/$/, '')
}

/**
 * Load a per-agent harness config from the Allternit platform API/registry.
 * Platform agents are identified by UUID agent ids. The runtime uses the
 * session-ingress auth token (or ALLTERNIT_API_TOKEN) to call the platform.
 */
export async function getPlatformHarnessConfig(
  agentId: string,
): Promise<HarnessConfig | undefined> {
  if (!looksLikePlatformAgentId(agentId)) {
    return undefined
  }

  const baseUrl = getAllternitApiBase()
  const url = `${baseUrl}/api/v1/agents/${encodeURIComponent(agentId)}`
  const authHeaders = getSessionIngressAuthHeaders()
  const token =
    process.env.ALLTERNIT_API_TOKEN || authHeaders.Authorization?.split(' ')[1]

  if (!token) {
    return undefined
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  }).catch(() => undefined)

  if (!response || !response.ok) {
    return undefined
  }

  const data = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  const agent = (data.agent ?? data) as Record<string, unknown>
  const harness = agent.harness_config ?? agent.harness
  if (!harness || typeof harness !== 'object') {
    return undefined
  }

  return validateHarnessConfig(harness)
}

/**
 * Resolve the effective harness configuration for an agent.
 *
 * Order of precedence (highest to lowest):
 * 1. Platform API/registry harness when agentId is a platform UUID
 * 2. Per-agent harness in gizzi runtime config (agent.<name>.harness)
 * 3. Global harness config from the CLI UI migration store
 * 4. undefined when no harness is configured
 */
export async function getAgentHarnessConfig(
  agentName?: string,
): Promise<HarnessConfig | undefined> {
  if (agentName && looksLikePlatformAgentId(agentName)) {
    const platformConfig = await getPlatformHarnessConfig(agentName).catch(
      () => undefined,
    )
    if (platformConfig) {
      return platformConfig
    }
  }

  const [globalMigrationConfig, agentInfo] = await Promise.all([
    getGlobalHarnessConfig().catch(() => undefined),
    agentName ? Agent.get(agentName).catch(() => undefined) : undefined,
  ])

  const globalConfig = normalizeMigrationConfig(globalMigrationConfig)
  const perAgentConfig = agentInfo?.harness

  if (!perAgentConfig) {
    return globalConfig
  }

  if (!globalConfig || globalConfig.mode === perAgentConfig.mode) {
    return perAgentConfig
  }

  // Mode-specific merge: per-agent mode wins, but inherit mode-specific keys
  // from the global config when the per-agent config does not provide them.
  const merged: HarnessConfig = { mode: perAgentConfig.mode }

  switch (perAgentConfig.mode) {
    case 'byok':
      merged.byok = perAgentConfig.byok ?? globalConfig.byok
      break
    case 'cloud':
      merged.cloud = perAgentConfig.cloud ?? globalConfig.cloud
      break
    case 'local':
      merged.local = perAgentConfig.local ?? globalConfig.local
      break
    case 'subprocess':
      merged.subprocess = perAgentConfig.subprocess ?? globalConfig.subprocess
      break
  }

  return merged
}

/**
 * Create an AllternitHarness instance for the requested agent.
 * Returns undefined when no harness config is available.
 */
export async function createAgentHarness(
  agentName?: string,
): Promise<AllternitHarness | undefined> {
  const config = await getAgentHarnessConfig(agentName)
  if (!config) {
    return undefined
  }
  return new AllternitHarness(config)
}

/**
 * Persist per-agent harness configuration into gizzi runtime config.
 * This mutates the global agent config map and writes it back.
 */
export async function setAgentHarnessConfig(
  agentName: string,
  harness: HarnessConfig | undefined,
): Promise<void> {
  const cfg = await Config.get()
  const existing = cfg.agent?.[agentName] ?? {}

  const updated: Config.Agent = {
    ...existing,
  }

  if (harness === undefined) {
    delete updated.harness
  } else {
    updated.harness = harness
  }

  await Config.updateGlobal({
    agent: {
      ...cfg.agent,
      [agentName]: updated,
    },
  })
}

/**
 * Persist the global harness config in the migration store.
 * Accepts canonical SDK shape and converts to migration storage shape.
 */
export async function setGlobalHarnessConfigSdk(
  config: HarnessConfig,
): Promise<void> {
  await setGlobalHarnessConfig(denormalizeToMigrationConfig(config))
}

/**
 * Expose the global harness config helper, normalized to SDK shape.
 */
export async function getGlobalHarnessConfigSdk(): Promise<
  HarnessConfig | undefined
> {
  const migrationConfig = await getGlobalHarnessConfig().catch(() => undefined)
  return normalizeMigrationConfig(migrationConfig)
}

/**
 * Validate a harness configuration object without constructing a harness.
 * Throws if the configuration is invalid.
 */
export function validateHarnessConfig(config: unknown): HarnessConfig {
  // Constructing the harness validates the shape via its constructor.
  // We do not retain the instance so callers can decide when to stream.
  const harnessConfig = config as HarnessConfig
  new AllternitHarness(harnessConfig)
  return harnessConfig
}

/**
 * Screen-facing harness service facade (merge-rot repair: the ink screens
 * were written against this API but it was never merged). Lazily backed by
 * createAgentHarness(); reports unavailable until a harness config exists.
 * sendMessage throws loudly when invoked while no harness is available.
 */
export interface HarnessServiceCallbacks {
  onText?: (text: string) => void
  onToolUse?: (toolUse: { id: string; name: string; arguments?: string }) => void
  onToolResult?: (result: unknown) => void
  onError?: (err: Error) => void
  onComplete?: () => void
}

export interface HarnessService {
  isAvailable(): boolean
  cancel(): void
  sendMessage(input: string, callbacks: HarnessServiceCallbacks): Promise<void>
}

let harnessServiceSingleton: HarnessService | undefined

export function getHarnessService(): HarnessService {
  if (harnessServiceSingleton) {
    return harnessServiceSingleton
  }
  let harness: AllternitHarness | undefined
  let harnessConfig: HarnessConfig | undefined
  let initPromise: Promise<void> | undefined
  let cancelled = false

  const ensureHarness = (): Promise<void> => {
    if (!initPromise) {
      initPromise = (async () => {
        harness = await createAgentHarness().catch(() => undefined)
        if (harness) {
          harnessConfig = await getAgentHarnessConfig().catch(() => undefined)
        }
      })()
    }
    return initPromise
  }

  const defaultProvider = (): string => {
    const keys = harnessConfig?.byok ? Object.keys(harnessConfig.byok) : []
    return keys[0] ?? 'anthropic'
  }

  harnessServiceSingleton = {
    isAvailable: () => harness !== undefined,
    cancel: () => {
      cancelled = true
    },
    sendMessage: async (input, callbacks) => {
      await ensureHarness()
      if (!harness) {
        throw new Error(
          'Harness service unavailable: no harness configuration found',
        )
      }
      cancelled = false
      try {
        for await (const chunk of harness.stream({
          provider: defaultProvider(),
          model: 'claude-3-5-haiku',
          messages: [{ role: 'user', content: input }],
          stream: true,
        })) {
          if (cancelled) {
            break
          }
          switch (chunk.type) {
            case 'text':
              callbacks.onText?.(chunk.text)
              break
            case 'tool_call':
            case 'tool_call_complete':
              callbacks.onToolUse?.({
                id: chunk.id,
                name: chunk.name,
                arguments:
                  typeof chunk.arguments === 'string'
                    ? chunk.arguments
                    : JSON.stringify(chunk.arguments),
              })
              break
            case 'tool_result':
              callbacks.onToolResult?.(chunk)
              break
            case 'error':
              callbacks.onError?.(
                chunk.error instanceof Error
                  ? chunk.error
                  : new Error(String(chunk.error)),
              )
              break
            case 'done':
              callbacks.onComplete?.()
              break
          }
        }
      } catch (err) {
        callbacks.onError?.(err instanceof Error ? err : new Error(String(err)))
      }
    },
  }
  return harnessServiceSingleton
}

export default {
  getAgentHarnessConfig,
  createAgentHarness,
  setAgentHarnessConfig,
  getGlobalHarnessConfig: getGlobalHarnessConfigSdk,
  setGlobalHarnessConfig: setGlobalHarnessConfigSdk,
  validateHarnessConfig,
  getHarnessService,
}
