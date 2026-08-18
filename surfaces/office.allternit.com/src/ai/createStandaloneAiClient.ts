import { OfficeAgentLoop } from '@allternit/office-ai'
import type { OfficeAiClient, OfficeAppKey } from '@allternit/allternit-office-suite'

const OVERRIDES_KEY = 'allternit-office-standalone:model-overrides'

interface Overrides {
  docs?: string
  sheets?: string
  slides?: string
  pdf?: string
}

function readOverrides(): Overrides {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(OVERRIDES_KEY) : null
    return raw ? (JSON.parse(raw) as Overrides) : {}
  } catch {
    return {}
  }
}

function writeOverrides(overrides: Overrides): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides))
    }
  } catch {
    /* storage unavailable */
  }
}

/**
 * Standalone AI client for the office surface.
 *
 * Wires the vendored office apps to the Pages Function at /api/agent-chat
 * using the generic OfficeAgentLoop from @allternit/office-ai. The model
 * catalog is intentionally minimal (a single default) because the standalone
 * surface has no platform model catalog; per-app overrides are persisted in
 * localStorage.
 */
export function createStandaloneAiClient(): OfficeAiClient {
  return {
    resolveModelId: (appKey: OfficeAppKey) => {
      const overrides = readOverrides()
      const value = overrides[appKey]
      return value && value !== 'platform' ? value : undefined
    },

    setModelOverride: (appKey: OfficeAppKey, modelId: string | undefined) => {
      const overrides = readOverrides()
      if (modelId && modelId !== 'platform') {
        overrides[appKey] = modelId
      } else {
        delete overrides[appKey]
      }
      writeOverrides(overrides)
    },

    getModelOptions: () => [
      {
        id: 'platform',
        runtimeId: 'platform',
        label: 'Default model',
      },
    ],

    refreshModelOptions: async function () {
      return this.getModelOptions()
    },

    getModelLabel: (value?: string) => {
      if (!value || value === 'platform') return 'Default model'
      return value
    },

    AgentLoop: OfficeAgentLoop as OfficeAiClient['AgentLoop'],
  }
}
