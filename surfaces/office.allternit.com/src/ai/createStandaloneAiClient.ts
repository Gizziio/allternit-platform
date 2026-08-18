import type {
  OfficeAgentLoop,
  OfficeAgentLoopEvents,
  OfficeAgentLoopOptions,
  OfficeAiClient,
  OfficeAppKey,
} from '@allternit/allternit-office-suite'
import { OfficeAgentLoop as CloudAgentLoop } from '@allternit/office-ai'

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

const SIGN_IN_MESSAGE =
  'Sign in to Allternit to use the AI assistant. Local, no-login AI is coming soon.'

class StandaloneAgentLoop implements OfficeAgentLoop {
  busy = false
  private readonly cloud: CloudAgentLoop
  private readonly events: OfficeAgentLoopEvents
  private readonly getIsSignedIn: () => boolean

  constructor(opts: OfficeAgentLoopOptions & { getIsSignedIn?: () => boolean }) {
    this.getIsSignedIn = opts.getIsSignedIn ?? (() => false)
    this.cloud = new CloudAgentLoop(
      opts as ConstructorParameters<typeof CloudAgentLoop>[0]
    )
    this.events = opts.events ?? {}
  }

  setModelId(modelId: string | undefined): void {
    this.cloud.setModelId(modelId)
  }

  reset(): void {
    this.cloud.reset()
    this.busy = false
  }

  restore(messages: readonly { role: string; text: string }[]): void {
    this.cloud.restore(messages)
  }

  cancel(): void {
    this.cloud.cancel()
  }

  run(instruction: string, images?: unknown[]): void {
    if (!this.getIsSignedIn()) {
      this.busy = true
      this.events.onText?.(SIGN_IN_MESSAGE)
      this.events.onDone?.({
        text: SIGN_IN_MESSAGE,
        cancelled: false,
        turnLimit: false,
      })
      this.busy = false
      return
    }
    this.cloud.run(instruction, images)
  }
}

/**
 * Standalone AI client for the office surface.
 *
 * Uses the cloud `/api/agent-chat` endpoint so the office apps can route user
 * requests to their tools. When the user is not signed in, runs are gated with
 * a clear sign-in message instead of hitting the endpoint.
 */
export function createStandaloneAiClient(options?: { getIsSignedIn?: () => boolean }): OfficeAiClient {
  const getIsSignedIn = options?.getIsSignedIn ?? (() => false)
  return {
    resolveModelId: (appKey: OfficeAppKey) => {
      const overrides = readOverrides()
      const value = overrides[appKey]
      return value && value !== 'cloud' ? value : undefined
    },

    setModelOverride: (appKey: OfficeAppKey, modelId: string | undefined) => {
      const overrides = readOverrides()
      if (modelId && modelId !== 'cloud') {
        overrides[appKey] = modelId
      } else {
        delete overrides[appKey]
      }
      writeOverrides(overrides)
    },

    getModelOptions: () => [
      {
        id: 'cloud',
        runtimeId: 'cloud',
        label: 'Allternit Cloud',
      },
    ],

    refreshModelOptions: async function (this: OfficeAiClient) {
      return this.getModelOptions()
    },

    getModelLabel: (value?: string) => {
      if (!value || value === 'cloud') return 'Allternit Cloud'
      return value
    },

    AgentLoop: class SignedInAgentLoop extends StandaloneAgentLoop {
      constructor(opts: OfficeAgentLoopOptions) {
        super({ ...opts, getIsSignedIn })
      }
    } as OfficeAiClient['AgentLoop'],
  }
}
