/**
 * Provider Loaders Registry
 *
 * Maps provider IDs to their loader functions.
 * Supported providers: Allternit, OpenAI, Google, Mistral, Gizzi, Qwen, Kimi, MiniMax, GLM/Zhipu
 */

import type { ProviderLoader } from "../../types"
import { allternitLoader } from "./allternit"
import { openaiLoader } from "./openai"
import { gizziLoader, gizziioLoader } from "./misc"
import { localLoader } from "./local"
import { LocalModelServer, type ManagedProviderConfig } from "@/runtime/local-model-server"
import { Config } from "@/runtime/context/config/config"

/**
 * Wrap a local loader so the per-model server (mlx_lm.server, opt-in via
 * `options.modelPath` in gizzi.json) is spawned/adopted/killed as needed
 * before getModel resolves the served model id.
 */
function managedLocal(providerID: string, loader: ProviderLoader): ProviderLoader {
  return async (provider) => {
    const result = await loader(provider)
    if (!result.getModel) return result
    const inner = result.getModel
    return {
      ...result,
      getModel: async (sdk, modelID, options) => {
        const cfg = await Config.get()
        await LocalModelServer.ensure(
          { providerID, modelID },
          cfg.provider?.[providerID] as ManagedProviderConfig | undefined,
        )
        return inner(sdk, modelID, options)
      },
    }
  }
}

export const CUSTOM_LOADERS: Record<string, ProviderLoader> = {
  "allternit": allternitLoader,
  // models.dev catalog id for Claude models — same Messages-API loader
  "anthropic": allternitLoader,
  "openai": openaiLoader,
  "gizzi": gizziLoader,
  "gizziio": gizziioLoader,
  "local-mlx": managedLocal("local-mlx", localLoader),
  "local": managedLocal("local", localLoader),
  // google, mistral, qwen, kimi, minimax, glm — no custom loaders needed,
  // they work via models.dev catalog + BUNDLED_PROVIDERS or @ai-sdk/openai-compatible
}
