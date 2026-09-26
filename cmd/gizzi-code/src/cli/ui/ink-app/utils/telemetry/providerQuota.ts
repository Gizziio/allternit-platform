/**
 * Bridge from the ink-app to the runtime provider-quota and discovery
 * modules. Same require()-in-try/catch pattern as ModelPicker.tsx /
 * modelOptions.ts: the runtime must never break the TUI when unavailable,
 * and quota is strictly best-effort — a provider that reports nothing
 * yields `undefined`, never a fabricated window.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import type { TelemetryQuotaResult } from './runTelemetryModel.js'

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
 * resolved through runtime Discovery. Only returns providers that actually
 * have a quota fetcher — everything else is "not reported".
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
    const supported = new Set(quota.ProviderQuotas.supported())
    for (const dp of Discovery.last()) {
      if (!supported.has(dp.id)) continue
      for (const m of dp.models) {
        if (`${dp.id}/${m.id}` === model || m.id === model) return dp.id
      }
    }
  } catch {}
  return undefined
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
