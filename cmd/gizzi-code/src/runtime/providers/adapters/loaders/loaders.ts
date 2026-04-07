/**
 * Provider Loaders Registry
 *
 * Maps provider IDs to their loader functions.
 * Supported providers: Anthropic, OpenAI, Google, Mistral, Gizzi, Qwen, Kimi, MiniMax, GLM/Zhipu
 */

import type { ProviderLoader } from "../../types"
import { anthropicLoader } from "./anthropic"
import { openaiLoader } from "./openai"
import { gizziLoader, gizziioLoader } from "./misc"

export const CUSTOM_LOADERS: Record<string, ProviderLoader> = {
  "anthropic": anthropicLoader,
  "openai": openaiLoader,
  "gizzi": gizziLoader,
  "gizziio": gizziioLoader,
  // google, mistral, qwen, kimi, minimax, glm — no custom loaders needed,
  // they work via models.dev catalog + BUNDLED_PROVIDERS or @ai-sdk/openai-compatible
}
