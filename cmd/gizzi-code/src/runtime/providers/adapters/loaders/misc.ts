/**
 * Gizzi provider loaders
 */

import type { ProviderLoader, ProviderInfo } from "../../types"

/** Shared logic for gizzi/gizziio providers */
async function loadGIZZIProvider(input: ProviderInfo): Promise<{ autoload: boolean; options?: Record<string, any> }> {
  const { Env } = await import("@/runtime/context/env")
  const { Auth } = await import("@/runtime/integrations/auth")
  const { Config } = await import("@/runtime/context/config/config")

  const hasKey = await (async () => {
    const env = Env.all()
    if (input.env.some((item) => env[item])) return true
    if (await Auth.get(input.id)) return true
    const config = await Config.get()
    if (config.provider?.["gizzi"]?.options?.apiKey || config.provider?.["gizziio"]?.options?.apiKey) return true
    return false
  })()

  if (!hasKey) {
    for (const [key, value] of Object.entries(input.models)) {
      if (value.cost.input === 0) continue
      delete input.models[key]
    }
  }

  return {
    autoload: Object.keys(input.models).length > 0,
    options: hasKey ? {} : { apiKey: "public" },
  }
}

export const gizziLoader: ProviderLoader = async (input) => loadGIZZIProvider(input)
export const gizziioLoader: ProviderLoader = async (input) => loadGIZZIProvider(input)
