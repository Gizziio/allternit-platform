import type { ProviderLoader } from "../../types"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "local-provider-loader" })

/**
 * Loader for local OpenAI-compatible servers (mlx_lm.server, Ollama, vLLM, etc.).
 *
 * Local servers advertise their real model id via /v1/models, which often does
 * not match the short human-readable id stored in config (e.g. mlx_lm.server
 * exposes the full filesystem path while the user configured
 * local-mlx/qwen3.6-35b-a3b-4bit). This loader resolves the active model id at
 * request time so the server receives a model id it actually recognizes.
 */
export const localLoader: ProviderLoader = async () => {
  return {
    autoload: true,
    options: {},
    async getModel(sdk: any, modelID: string, options?: Record<string, any>) {
      const baseURL = options?.["baseURL"] as string | undefined
      if (!baseURL) {
        log.debug("no baseURL, using configured model id", { modelID })
        return sdk.languageModel(modelID)
      }

      try {
        const url = new URL("models", baseURL.replace(/\/$/, "") + "/")
        const res = await fetch(url, {
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) {
          const json = (await res.json()) as { data?: { id: string }[] }
          const first = json.data?.[0]?.id
          if (first) {
            log.debug("resolved local model id", { configured: modelID, resolved: first })
            return sdk.languageModel(first)
          }
        }
      } catch (e) {
        log.debug("failed to resolve local model id", { error: e, modelID, baseURL })
      }

      return sdk.languageModel(modelID)
    },
  }
}
