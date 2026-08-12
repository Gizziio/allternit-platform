/**
 * Model selection helpers for the vendored office apps.
 *
 * The Allternit platform persists the user's chosen provider/model under
 * `allternit:model-selection` as `{ providerId, profileId, modelId, modelName }`.
 * Office apps are isolated packages and can't import platform React context, so
 * they read the same localStorage key directly. Each app may also store its own
 * override in `allternit:office-ai:model-overrides`.
 *
 * The platform also caches the provider/model discovery payload under
 * `allternit-provider-discovery-cache-v2`; when present we build the picker
 * options from that cache so the office apps show the same models the platform
 * chat composer offers.
 */

const PLATFORM_MODEL_KEY = 'allternit:model-selection'
const OFFICE_MODEL_OVERRIDES_KEY = 'allternit:office-ai:model-overrides'
const PROVIDER_DISCOVERY_CACHE_KEY = 'allternit-provider-discovery-cache-v2'

export interface PlatformModelSelection {
  providerId?: string
  profileId?: string
  modelId?: string
  modelName?: string
}

export type OfficeAppKey = 'sheets' | 'docs' | 'slides' | 'pdf'

export interface OfficeModelOverrides {
  sheets?: string
  docs?: string
  slides?: string
  pdf?: string
}

export interface OfficeModelOption {
  id: string
  /** provider/model runtime id */
  runtimeId: string
  label: string
  /** provider name, e.g. "Kimi" or "OpenAI" */
  provider?: string | undefined
}

interface DiscoveryModel {
  id?: string | undefined
  name?: string | undefined
  providerId?: string | undefined
  providerName?: string | undefined
}

/** Read the platform's selected model and return it as `provider/modelId`. */
export function resolvePlatformModelId(): string | undefined {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(PLATFORM_MODEL_KEY) : null
    if (raw) {
      const parsed = JSON.parse(raw) as PlatformModelSelection | null
      if (parsed?.providerId && parsed?.modelId) {
        return `${parsed.providerId}/${parsed.modelId}`
      }
    }
  } catch {
    /* malformed or unavailable storage */
  }
  return undefined
}

/** Human-readable name for the platform's currently selected model. */
export function resolvePlatformModelName(): string | undefined {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(PLATFORM_MODEL_KEY) : null
    if (raw) {
      const parsed = JSON.parse(raw) as PlatformModelSelection | null
      return parsed?.modelName ?? undefined
    }
  } catch {
    /* malformed or unavailable storage */
  }
  return undefined
}

/** Build the office model picker options from the platform's discovery cache. */
export function getOfficeModelOptions(): OfficeModelOption[] {
  const options: OfficeModelOption[] = []

  // 1) Platform default entry (uses whatever the platform has selected).
  const platformName = resolvePlatformModelName()
  options.push({
    id: 'platform',
    runtimeId: resolvePlatformModelId() ?? 'platform',
    label: platformName ? `Platform: ${platformName}` : 'Platform default',
  })

  // 2) Runtime-discovered models cached by the platform composer.
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(PROVIDER_DISCOVERY_CACHE_KEY) : null
    if (raw) {
      const parsed = JSON.parse(raw) as { models?: DiscoveryModel[] } | null
      const models = parsed?.models
      if (Array.isArray(models)) {
        for (const m of models) {
          if (!m.id) continue
          // De-duplicate against the platform default.
          if (m.id === options[0]?.runtimeId) continue
          options.push({
            id: m.id,
            runtimeId: m.id,
            label: m.name || m.id,
            provider: m.providerName || m.providerId,
          })
        }
      }
    }
  } catch {
    /* cache unavailable or malformed */
  }

  return options
}

/** Get the per-app override (or undefined when using platform default). */
export function getOfficeModelOverride(app: OfficeAppKey): string | undefined {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(OFFICE_MODEL_OVERRIDES_KEY) : null
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as OfficeModelOverrides | null
    return parsed?.[app] ?? undefined
  } catch {
    return undefined
  }
}

/** Persist a per-app override. Pass `"platform"` or `undefined` to fall back to the platform choice. */
export function setOfficeModelOverride(app: OfficeAppKey, modelId: string | undefined): void {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(OFFICE_MODEL_OVERRIDES_KEY) : null
    const parsed: OfficeModelOverrides = raw ? (JSON.parse(raw) as OfficeModelOverrides) : {}
    if (modelId && modelId !== 'platform') parsed[app] = modelId
    else delete parsed[app]
    window.localStorage.setItem(OFFICE_MODEL_OVERRIDES_KEY, JSON.stringify(parsed))
  } catch {
    /* storage unavailable */
  }
}

/** Resolve the effective runtime model id for an office app. */
export function resolveOfficeModelId(app: OfficeAppKey): string | undefined {
  const override = getOfficeModelOverride(app)
  if (override && override !== 'platform') return override
  return resolvePlatformModelId()
}

/** Resolve the effective picker value (the option id, not the runtime model id). */
export function resolveOfficeModelValue(app: OfficeAppKey): string {
  const override = getOfficeModelOverride(app)
  return override && override !== 'platform' ? override : 'platform'
}

/** Fetch the live model catalog from the platform and refresh the cache. */
export async function refreshOfficeModelOptions(): Promise<OfficeModelOption[]> {
  const options: OfficeModelOption[] = []
  const platformName = resolvePlatformModelName()
  options.push({
    id: 'platform',
    runtimeId: resolvePlatformModelId() ?? 'platform',
    label: platformName ? `Platform: ${platformName}` : 'Platform default',
  })

  try {
    const response = await fetch('/api/v1/models')
    if (!response.ok) return options
    const catalog = (await response.json()) as Array<{
      id?: string
      name?: string
      provider?: string
    }> | null
    if (!Array.isArray(catalog)) return options

    const models: DiscoveryModel[] = catalog
      .filter((m) => typeof m.id === 'string' && m.id.length > 0)
      .map((m) => ({
        id: m.id as string,
        name: m.name,
        providerId: m.provider,
        providerName: m.provider,
      }))

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          PROVIDER_DISCOVERY_CACHE_KEY,
          JSON.stringify({ ts: Date.now(), models }),
        )
      } catch {
        // storage unavailable
      }
    }

    for (const m of models) {
      const id = m.id
      if (!id || id === options[0]?.runtimeId) continue
      options.push({
        id,
        runtimeId: id,
        label: m.name || id,
        provider: m.providerName || m.providerId,
      })
    }
  } catch {
    // Offline or API unavailable: fall back to the cached options already in options.
  }

  return options
}

/** Human-readable label for a picker value, using live platform/cache data. */
export function getOfficeModelLabel(value: string | undefined): string {
  if (!value || value === 'platform') {
    return resolvePlatformModelName() ?? 'Platform default'
  }
  const option = getOfficeModelOptions().find((o) => o.id === value)
  return option?.label ?? value
}
