/**
 * Bridge from the ink-app to the runtime provider-quota and discovery
 * modules. Same require()-in-try/catch pattern as ModelPicker.tsx /
 * modelOptions.ts: the runtime must never break the TUI when unavailable,
 * and quota is strictly best-effort — a provider that reports nothing
 * yields `undefined`, never a fabricated window.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import type { TelemetryQuotaResult } from './runTelemetryModel.js'
import { QUOTA_NA_CHIP, quotaChipFromResult } from './runTelemetryModel.js'

type DiscoveryModule =
  typeof import('../../../../../runtime/providers/discovery/index.js')
type QuotaModule =
  typeof import('../../../../../runtime/providers/quota/index.js')

function quotaModule(): QuotaModule | null {
  try {
    return require('../../../../../runtime/providers/quota/index.js') as QuotaModule
  } catch {
    return null
  }
}

/**
 * Provider id (for ProviderQuotas.get) of the provider serving `model`,
 * resolved through runtime Discovery — or, for models.dev providers that
 * never pass through Discovery (e.g. `openrouter/anthropic/claude-x`), the
 * model string's provider prefix when that provider has a quota fetcher.
 * Returns providers regardless of whether they have a fetcher — pair with
 * quotaProviderSupported() to decide between fetching and the honest
 * "quota n/a" marker. Undefined means the provider is unknown: no claim.
 */
export function resolveQuotaProviderId(
  model: string | undefined,
): string | undefined {
  if (!model) return undefined
  const quota = quotaModule()
  if (!quota) return undefined
  try {
    const { Discovery } =
      require('../../../../../runtime/providers/discovery/index.js') as DiscoveryModule
    Discovery.prefetch()
    for (const dp of Discovery.last()) {
      for (const m of dp.models) {
        if (`${dp.id}/${m.id}` === model || m.id === model) return dp.id
      }
    }
  } catch {}
  const slash = model.indexOf('/')
  if (slash > 0) {
    const prefix = model.slice(0, slash)
    if (quota.ProviderQuotas.supported().includes(prefix)) return prefix
  }
  return undefined
}

/**
 * Whether a provider has a real quota fetcher (a documented endpoint the
 * runtime can read with credentials the user already configured). False
 * means the UI should say "quota n/a" rather than render an empty slot.
 */
export function quotaProviderSupported(providerID: string): boolean {
  const quota = quotaModule()
  if (!quota) return false
  try {
    return quota.ProviderQuotas.supported().includes(providerID)
  } catch {
    return false
  }
}

/**
 * One quota read for a provider. Undefined when the runtime module is
 * unavailable or the fetch itself throws — callers render "not reported".
 * ProviderQuotas caches per provider for 60s, so repeat reads are cheap.
 */
export async function fetchProviderQuota(
  providerID: string,
): Promise<TelemetryQuotaResult | undefined> {
  const quota = quotaModule()
  if (!quota) return undefined
  try {
    return (await quota.ProviderQuotas.get(providerID)) as TelemetryQuotaResult
  } catch {
    return undefined
  }
}

/**
 * Chip text for the per-turn telemetry line: the tightest real window for
 * providers with a fetcher, the explicit "quota n/a" marker for providers
 * with no quota API, and null for fetch failures (transient — never a
 * fabricated number). Providers with no fetcher resolve synchronously with
 * no network call.
 */
export async function quotaChipForProvider(
  providerID: string,
): Promise<string | null> {
  if (!quotaProviderSupported(providerID)) return QUOTA_NA_CHIP
  return quotaChipFromResult(await fetchProviderQuota(providerID))
}
