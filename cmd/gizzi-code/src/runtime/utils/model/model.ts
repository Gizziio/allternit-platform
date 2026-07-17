// Auto-generated shim to satisfy TypeScript imports

/** Canonical short name for a model id (last path segment). */
export function getCanonicalName(modelId: string): string {
  return modelId.split('/').pop() ?? modelId
}

/** Model used for the main conversation loop. */
export function getMainLoopModel(): string {
  return process.env.GIZZI_MODEL ?? 'default'
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export * from '../../../shared/utils/model/model.js'
