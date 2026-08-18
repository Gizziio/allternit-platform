import type { OfficeAiClient, OfficeAppKey } from '@allternit/allternit-office-suite'
import { NeedleAgentLoop } from './NeedleAgentLoop'

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
 * Standalone, no-login AI client for the office surface.
 *
 * Uses Cactus Needle (≈14 MB, browser-local) as the agent loop so the office
 * apps can route user requests to their tools without any server or API key.
 */
export function createStandaloneAiClient(): OfficeAiClient {
  return {
    resolveModelId: (appKey: OfficeAppKey) => {
      const overrides = readOverrides()
      const value = overrides[appKey]
      return value && value !== 'local' ? value : undefined
    },

    setModelOverride: (appKey: OfficeAppKey, modelId: string | undefined) => {
      const overrides = readOverrides()
      if (modelId && modelId !== 'local') {
        overrides[appKey] = modelId
      } else {
        delete overrides[appKey]
      }
      writeOverrides(overrides)
    },

    getModelOptions: () => [
      {
        id: 'local',
        runtimeId: 'local',
        label: 'Local (Cactus Needle)',
      },
    ],

    refreshModelOptions: async function () {
      return this.getModelOptions()
    },

    getModelLabel: (value?: string) => {
      if (!value || value === 'local') return 'Local (Cactus Needle)'
      return value
    },

    AgentLoop: NeedleAgentLoop as OfficeAiClient['AgentLoop'],
  }
}
