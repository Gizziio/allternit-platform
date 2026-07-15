/**
 * Image model IDs supported by the application
 *
 * Derived from the registry snapshot (models.generated.ts) — the previous
 * hardcoded list named "openai/dall-e-3"/"openai/dall-e-2"/"stability-ai/sd-xl",
 * none of which exist in the current gateway (OpenAI and Stability AI have no
 * image-type entries in this snapshot at all), plus a malformed "recraft-v3"
 * missing its "recraft/" provider prefix.
 */

import { models as generatedModels } from "@/lib/ai/models.generated";

interface GeneratedImageModel { id: string; type: string; owned_by: string; tags?: string[] }

const REGISTRY_IMAGE_MODEL_IDS = (generatedModels as readonly GeneratedImageModel[])
  .filter((m) => m.type === "image")
  .map((m) => m.id);

const IMAGE_MODEL_IDS = [
  "google/gemini-3-pro-image",
  ...REGISTRY_IMAGE_MODEL_IDS,
] as const;

export type ImageModelId = (typeof IMAGE_MODEL_IDS)[number];

// Alias for compatibility
export type AnyImageModelId = ImageModelId;

// Vision-capable first-party chat models, for image generation via
// generateText rather than a dedicated image endpoint. Filtered by the
// registry's "vision" tag directly (not every current model has it — e.g.
// gemini-2.5-pro/flash currently don't in this snapshot).
const VISION_PROVIDERS = new Set(["openai", "anthropic", "google"]);
const MULTIMODAL_IMAGE_MODEL_IDS = (generatedModels as readonly GeneratedImageModel[])
  .filter((m) => m.type === "language" && VISION_PROVIDERS.has(m.owned_by) && (m.tags ?? []).includes("vision"))
  .map((m) => m.id);

export type MultimodalImageModelId = (typeof MULTIMODAL_IMAGE_MODEL_IDS)[number];
