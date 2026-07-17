export * from '../../runtime/types/model.js'

/** Canonical short name for a model id (last path segment). */
export function getCanonicalName(modelId: string): string {
  return modelId.split('/').pop() ?? modelId
}

/** Display name for prompts; the canonical name in this build. */
export function getMarketingNameForModel(modelId: string): string {
  return getCanonicalName(modelId)
}

/** Small/fast model for background tasks (summaries, titles). */
export function getSmallFastModel(): string {
  return process.env.GIZZI_SMALL_MODEL ?? 'default'
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export * from '../../shared/utils/model/model.js'
