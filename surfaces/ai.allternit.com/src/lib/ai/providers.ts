import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { gateway } from "@ai-sdk/gateway";
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

export const getLanguageModel = async (modelId: ModelId) => {
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
