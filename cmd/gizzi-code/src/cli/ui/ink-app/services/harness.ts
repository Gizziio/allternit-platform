// @ts-nocheck
import { AllternitHarness } from '@allternit/sdk/harness'
import type { HarnessConfig } from '@allternit/sdk'
import { Config } from '@/runtime/context/config/config'
import { Agent } from '@/runtime/loop/agent'
import {
  getHarnessConfig as getGlobalHarnessConfig,
  setHarnessConfig as setGlobalHarnessConfig,
  type HarnessConfig as MigrationHarnessConfig,
} from '../utils/migration'

export type { HarnessConfig }

/**
 * Normalize the legacy/global harness config stored by migration.ts into the
 * canonical SDK harness shape. Migration stores BYOK keys as nested provider
 * objects (anthropic: { apiKey }) which matches the SDK shape, but it also
 * supports a legacy 'mode' value of 'legacy' that the SDK does not accept.
 */
function normalizeMigrationConfig(
  config: MigrationHarnessConfig | undefined,
): HarnessConfig | undefined {
  if (!config || config.mode === 'legacy') {
    return undefined
  }

  const normalized: HarnessConfig = { mode: config.mode }

  if (config.mode === 'byok' && config.byok) {
    normalized.byok = {}
    if (config.byok.anthropic?.apiKey) {
      normalized.byok.anthropic = {
        apiKey: config.byok.anthropic.apiKey,
      }
    }
    if (config.byok.openai?.apiKey) {
      normalized.byok.openai = {
        apiKey: config.byok.openai.apiKey,
      }
    }
    if (config.byok.google?.apiKey) {
      normalized.byok.google = {
        apiKey: config.byok.google.apiKey,
      }
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
    if (config.byok.anthropic) {
      migration.byok.anthropic = {
        apiKey: config.byok.anthropic.apiKey,
      }
    }
    if (config.byok.openai) {
      migration.byok.openai = {
        apiKey: config.byok.openai.apiKey,
      }
    }
    if (config.byok.google) {
      migration.byok.google = {
        apiKey: config.byok.google.apiKey,
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

/**
 * Resolve the effective harness configuration for an agent.
 *
 * Order of precedence (highest to lowest):
 * 1. Per-agent harness in gizzi runtime config (agent.<name>.harness)
 * 2. Global harness config from the CLI UI migration store
 * 3. undefined when no harness is configured
 */
export async function getAgentHarnessConfig(
  agentName?: string,
): Promise<HarnessConfig | undefined> {
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

export default {
  getAgentHarnessConfig,
  createAgentHarness,
  setAgentHarnessConfig,
  getGlobalHarnessConfig: getGlobalHarnessConfigSdk,
  setGlobalHarnessConfig: setGlobalHarnessConfigSdk,
  validateHarnessConfig,
}
