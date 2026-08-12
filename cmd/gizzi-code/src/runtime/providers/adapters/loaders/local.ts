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
          const list = json.data ?? []
          // mlx_lm.server lists every mlx-compatible model in the whole HF
          // cache, not just the one it has loaded — it only appends the
          // actually-loaded --model as its own entry, always last, and only
          // when it's a local filesystem path. Picking data[0] there silently
          // hot-swaps the server to a random cached model on every request
          // (breaks generation quality and tool-calling support). An absolute
          // path is the one reliable signal for "the model actually running",
          // so prefer it; single-entry servers (Ollama, LM Studio) are
          // unaffected since they only ever report the one model that matters.
          const resolved = list.find((m) => m.id?.startsWith("/"))?.id ?? list[0]?.id
          if (resolved) {
            log.debug("resolved local model id", { configured: modelID, resolved })
            return sdk.languageModel(resolved)
          }
        }
      } catch (e) {
        log.debug("failed to resolve local model id", { error: e, modelID, baseURL })
      }

      return sdk.languageModel(modelID)
    },
  }
}
