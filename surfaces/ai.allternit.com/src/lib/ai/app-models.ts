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

// This surface is a Vite SPA — next/cache's unstable_cache throws outside a
// Next server, and the data here is a static in-memory snapshot anyway, so a
// module-level memo is all the caching this needs.
let allAppModelsPromise: Promise<AppModelDefinition[]> | undefined;

function fetchAllAppModels(): Promise<AppModelDefinition[]> {
  allAppModelsPromise ??= fetchModels().then(buildAppModels);
  return allAppModelsPromise;
}

/** All enabled language models from the registry snapshot (registry-derived — never hardcode ids). */
export async function listAppModels(): Promise<AppModelDefinition[]> {
  return fetchAllAppModels();
}

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

const DEFAULT_CHAT_MODEL: ModelId = "kimi/kimi-for-coding";
const DEFAULT_PDF_MODEL: ModelId = "kimi/kimi-for-coding";
const DEFAULT_TITLE_MODEL: ModelId = "kimi/kimi-for-coding";
const DEFAULT_ARTIFACT_MODEL: ModelId = "kimi/kimi-for-coding";
const DEFAULT_FOLLOWUP_SUGGESTIONS_MODEL: ModelId =
  "kimi/kimi-for-coding";
const DEFAULT_IMAGE_MODEL: AnyImageModelId = "google/gemini-3-pro-image";
const DEFAULT_CHAT_IMAGE_COMPATIBLE_MODEL: ModelId =
  "openai/gpt-4o-mini";
const DEFAULT_POLISH_TEXT_MODEL: ModelId = "kimi/kimi-for-coding";
const DEFAULT_FORMAT_AND_CLEAN_SHEET_MODEL: ModelId =
  "kimi/kimi-for-coding";
const DEFAULT_ANALYZE_AND_VISUALIZE_SHEET_MODEL: ModelId =
  "kimi/kimi-for-coding";

const DEFAULT_CODE_EDITS_MODEL: ModelId = "kimi/kimi-for-coding";

const ANONYMOUS_AVAILABLE_MODELS: AppModelId[] = [
  "kimi/kimi-for-coding",
  "kimi/kimi-for-coding",
  "kimi/kimi-for-coding",
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
function getDefaultEnabledModels(
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
