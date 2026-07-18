import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
import { createOpenAI } from "@ai-sdk/openai";
import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import type {
  ImageModelId,
  MultimodalImageModelId,
} from "../models/image-model-id";
import type { AppModelId, ModelId } from "./app-models";
import { getAppModelDefinition } from "./app-models";
import { getLatestAgentModel } from "@/lib/agents/agent-models";

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('Providers');

const _telemetryConfig = {
  telemetry: {
    isEnabled: true,
    functionId: "get-language-model",
  },
};

/**
 * Dev-mode model access: when VITE_LOCAL_AI_BASE_URL is set (see .env.local),
 * every language-model request goes to the local model-proxy sidecar
 * (scripts/model-proxy.mjs) instead of the Vercel AI gateway — which the
 * browser cannot reach directly (CORS) and which has no credential in local
 * dev. The requested registry model id passes through untouched; the sidecar
 * routes it to the right backend (kimi/* → kimi coding API, anthropic/* →
 * claude CLI, anything else → local Ollama) with credentials that never
 * reach the browser. Production builds without the env var are unaffected.
 */
const LOCAL_AI_BASE_URL = import.meta.env.VITE_LOCAL_AI_BASE_URL as
  | string
  | undefined;

/**
 * Reused keep-alive sockets to a local model server can silently die between
 * bursts of concurrent calls; a fetch on a dead socket never settles, which
 * wedges the whole run (observed live: a round's 5 requests all invoked, zero
 * responses). A per-request timeout turns the wedge into an abort, and the AI
 * SDK's built-in retry then reissues the call on a fresh connection.
 */
const LOCAL_AI_REQUEST_TIMEOUT_MS = 60_000;

const localAiFetch: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(LOCAL_AI_REQUEST_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;
  return fetch(input, { ...init, signal });
};

const getLocalLanguageModel = (requestedId: string) => {
  // The env var may be an origin-relative path; the OpenAI provider needs an
  // absolute base URL. Outside a browser (the model-proxy sidecar runs this
  // module under Bun for server-side simulations) there is no location — the
  // env var is absolute there, so the base is only a formality.
  const origin = globalThis.location?.origin ?? "http://127.0.0.1:8090";
  const baseURL = new URL(LOCAL_AI_BASE_URL!, origin).href;
  logger.debug(
    { requestedId, baseURL },
    "Local AI override active — routing via model-proxy sidecar"
  );
  return createOpenAI({ baseURL, apiKey: "local-dev", fetch: localAiFetch }).chat(
    requestedId
  );
};

export const getLanguageModel = async (modelId: ModelId) => {
  if (LOCAL_AI_BASE_URL) {
    return getLocalLanguageModel(modelId);
  }

  const model = await getAppModelDefinition(modelId);
  const languageProvider = gateway(model.id);

  // Add reasoning middleware if the model supports reasoning
  if (model.reasoning && model.owned_by === "xai") {
    console.debug("Wrapping reasoning middleware for", model.id);
    return wrapLanguageModel({
      model: languageProvider,
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    });
  }

  return languageProvider;
};

const getImageModel = (modelId: ImageModelId) =>
  gateway.imageModel(modelId);

// Get a multimodal language model that can generate images via generateText
const getMultimodalImageModel = (modelId: MultimodalImageModelId) =>
  gateway(modelId);

// Model aliases removed - use getLanguageModel directly with specific model IDs

/**
 * Strong reasoning/coding model for built-in plugins (code, research, slides,
 * swarms, etc.) that need a capable model without pinning a specific gateway
 * id. Resolves the current Anthropic model from the registry snapshot —
 * plugins previously hardcoded 'anthropic/claude-3-5-sonnet', which doesn't
 * match the gateway's id format (claude-3.5-sonnet) and would throw on every
 * invocation, on top of naming an already-superseded model.
 */
export const getDefaultPluginModel = async () =>
  getLanguageModel(getLatestAgentModel('anthropic').id as ModelId);

/**
 * Resolve a plugin's model: the caller's explicit registry id when given,
 * otherwise the registry default. This is the seam features use to honor a
 * user-selected model instead of pinning the default.
 */
export const getPluginModel = async (modelId?: ModelId) =>
  modelId ? getLanguageModel(modelId) : getDefaultPluginModel();

const getModelProviderOptions = async (
  providerModelId: AppModelId
): Promise<
  | {
      openai: OpenAIResponsesProviderOptions;
    }
  | {
      anthropic: AnthropicProviderOptions;
    }
  | {
      xai: Record<string, never>;
    }
  | {
      google: GoogleGenerativeAIProviderOptions;
    }
  | Record<string, never>
> => {
  const model = await getAppModelDefinition(providerModelId);
  if (model.owned_by === "openai") {
    if (model.reasoning) {
      return {
        openai: {
          reasoningSummary: "auto",
          ...(model.id === "openai/gpt-5" ||
          model.id === "openai/gpt-5-mini" ||
          model.id === "openai/gpt-5-nano"
            ? { reasoningEffort: "low" }
            : {}),
        } satisfies OpenAIResponsesProviderOptions,
      };
    }
    return { openai: {} };
  }
  if (model.owned_by === "anthropic") {
    if (model.reasoning) {
      return {
        anthropic: {
          thinking: {
            type: "enabled",
            budgetTokens: 4096,
          },
        } satisfies AnthropicProviderOptions,
      };
    }
    return { anthropic: {} };
  }
  if (model.owned_by === "xai") {
    return {
      xai: {},
    };
  }
  if (model.owned_by === "google") {
    if (model.reasoning) {
      return {
        google: {
          thinkingConfig: {
            thinkingBudget: 10_000,
          },
        },
      };
    }
    return { google: {} };
  }
  return {};
};
