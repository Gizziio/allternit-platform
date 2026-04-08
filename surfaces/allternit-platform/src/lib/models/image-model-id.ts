/**
 * Image model IDs supported by the application
 */

export const IMAGE_MODEL_IDS = [
  "openai/dall-e-3",
  "openai/dall-e-2",
  "stability-ai/sd-xl",
  "recraft-v3",
  "google/gemini-3-pro-image",
] as const;

export type ImageModelId = (typeof IMAGE_MODEL_IDS)[number];

// Alias for compatibility
export type AnyImageModelId = ImageModelId;

export function isValidImageModelId(modelId: string): modelId is ImageModelId {
  return IMAGE_MODEL_IDS.includes(modelId as ImageModelId);
}

export const DEFAULT_IMAGE_MODEL: ImageModelId = "openai/dall-e-3";

// Multimodal image model IDs
export const MULTIMODAL_IMAGE_MODEL_IDS = [
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "anthropic/claude-3-opus",
  "anthropic/claude-3-sonnet",
  "google/gemini-1.5-pro",
  "google/gemini-1.5-flash",
] as const;

export type MultimodalImageModelId = (typeof MULTIMODAL_IMAGE_MODEL_IDS)[number];

/**
 * Check if a model ID is a multimodal image model
 */
export function isMultimodalImageModel(modelId: string): modelId is MultimodalImageModelId {
  return MULTIMODAL_IMAGE_MODEL_IDS.includes(modelId as MultimodalImageModelId);
}
