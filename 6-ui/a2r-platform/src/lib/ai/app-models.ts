import { unstable_cache as cache } from "next/cache";
import { config } from "@/lib/config";
import type { AnyImageModelId } from "@/lib/models/image-model-id";
import type { AppModelId, ModelId } from "./app-model-id";
import type { ModelData } from "./model-data";
import type { AiGatewayModel } from "./ai-gateway-models-schemas";
import { models as generatedModels } from "./models.generated";

// Explicit type for generated models that includes optional tags
// This extends the base AiGatewayModel type with proper tags typing
type GeneratedModel = AiGatewayModel & { tags?: string[] };

// Cast the imported models to our explicit type
const typedModels: readonly GeneratedModel[] = generatedModels as readonly GeneratedModel[];

// Local fetchModels that returns ModelData from model-data.ts format
async function fetchModels(): Promise<ModelData[]> {
  // Transform generated models to ModelData format
  return typedModels.map(m => ({
    id: m.id,
    object: m.object,
    owned_by: m.owned_by,
    name: m.name,
    description: m.description,
    type: m.type,
    tags: m.tags,
    context_window: m.context_window,
    max_tokens: m.max_tokens,
    pricing: m.pricing,
    reasoning: m.tags?.includes("reasoning") ?? false,
    toolCall: m.tags?.includes("tool-use") ?? false,
    input: {
      image: m.tags?.includes("vision") ?? false,
      text: true,
      pdf: m.tags?.includes("pdf") ?? false,
      video: m.tags?.includes("video") ?? false,
      audio: m.tags?.includes("audio") ?? false,
    },
    output: {
      image: m.tags?.includes("image-generation") ?? false,
      text: true,
      audio: m.tags?.includes("audio") ?? false,
    },
  })) as ModelData[];
}

export type { AppModelId, ModelId } from "./app-model-id";

export type AppModelDefinition = Omit<ModelData, "id"> & {
  id: AppModelId;
  apiModelId: ModelId;
};

const DISABLED_MODELS = new Set(config.models.disabledModels);
const PROVIDER_ORDER = config.models.providerOrder;

function buildAppModels(models: ModelData[]): AppModelDefinition[] {
  return models
    .flatMap((model) => {
      const modelId = model.id as ModelId;
      // If the model supports reasoning, return two variants:
      // - Non-reasoning (original id, reasoning=false)
      // - Reasoning (id with -reasoning suffix, reasoning=true)
      if (model.reasoning === true) {
        const reasoningId: AppModelId = `${modelId}-reasoning`;

        return [
          {
            ...model,
            id: reasoningId,
            apiModelId: modelId,
            disabled: DISABLED_MODELS.has(modelId),
          },
          {
            ...model,
            reasoning: false,
            apiModelId: modelId,
            disabled: DISABLED_MODELS.has(modelId),
          },
        ];
      }

      // Models without reasoning stay as-is
      return [
        {
          ...model,
          apiModelId: modelId,
          disabled: DISABLED_MODELS.has(modelId),
        },
      ];
    })
    .filter(
      (model) => model.type === "language" && !model.disabled
    ) as AppModelDefinition[];
}

function buildChatModels(
  appModels: AppModelDefinition[]
): AppModelDefinition[] {
  return appModels
    .filter((model) => model.output.text === true)
    .sort((a, b) => {
      const aProviderIndex = PROVIDER_ORDER.indexOf(a.owned_by);
      const bProviderIndex = PROVIDER_ORDER.indexOf(b.owned_by);

      const aIndex =
        aProviderIndex === -1 ? PROVIDER_ORDER.length : aProviderIndex;
      const bIndex =
        bProviderIndex === -1 ? PROVIDER_ORDER.length : bProviderIndex;

      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }

      return 0;
    });
}

const fetchAllAppModels = cache(
  async (): Promise<AppModelDefinition[]> => {
    const models = await fetchModels();
    return buildAppModels(models);
  },
  ["all-app-models"],
  { revalidate: 3600, tags: ["ai-gateway-models"] }
);

export const fetchChatModels = cache(
  async (): Promise<AppModelDefinition[]> => {
    const appModels = await fetchAllAppModels();
    return buildChatModels(appModels);
  },
  ["chat-models"],
  { revalidate: 3600, tags: ["ai-gateway-models"] }
);

export async function getAppModelDefinition(
  modelId: AppModelId
): Promise<AppModelDefinition> {
  const models = await fetchAllAppModels();
  const model = models.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }
  return model;
}

export const DEFAULT_CHAT_MODEL: ModelId = "openai/gpt-5-nano";
export const DEFAULT_PDF_MODEL: ModelId = "openai/gpt-5-mini";
export const DEFAULT_TITLE_MODEL: ModelId = "google/gemini-2.5-flash-lite";
export const DEFAULT_ARTIFACT_MODEL: ModelId = "openai/gpt-5-nano";
export const DEFAULT_FOLLOWUP_SUGGESTIONS_MODEL: ModelId =
  "google/gemini-2.5-flash-lite";
export const DEFAULT_IMAGE_MODEL: AnyImageModelId = "google/gemini-3-pro-image";
export const DEFAULT_CHAT_IMAGE_COMPATIBLE_MODEL: ModelId =
  "openai/gpt-4o-mini";
export const DEFAULT_POLISH_TEXT_MODEL: ModelId = "openai/gpt-5-mini";
export const DEFAULT_FORMAT_AND_CLEAN_SHEET_MODEL: ModelId =
  "openai/gpt-5-mini";
export const DEFAULT_ANALYZE_AND_VISUALIZE_SHEET_MODEL: ModelId =
  "openai/gpt-5-mini";

export const DEFAULT_CODE_EDITS_MODEL: ModelId = "openai/gpt-5-mini";

export const ANONYMOUS_AVAILABLE_MODELS: AppModelId[] = [
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "anthropic/claude-haiku-4.5",
];
/**
 * Set of model IDs from the generated models file.
 * Used to detect new models from the API that we haven't "decided" on yet.
 */
const KNOWN_MODEL_IDS = new Set<string>(typedModels.map((m) => m.id));

/**
 * Returns the default enabled models for a given list of app models.
 * Includes curated defaults + any new models from the API not in models.generated.ts
 */
export function getDefaultEnabledModels(
  appModels: AppModelDefinition[]
): Set<AppModelId> {
  const enabled = new Set<AppModelId>(config.models.curatedDefaults);

  // Add any new models from the API that aren't in our generated snapshot
  for (const model of appModels) {
    if (!KNOWN_MODEL_IDS.has(model.apiModelId)) {
      enabled.add(model.id);
    }
  }

  return enabled;
}
