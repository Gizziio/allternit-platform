/**
 * Context Utilities
 */

export interface Context {
  sessionId?: string
  projectId?: string
  cwd: string
}

let currentContext: Context = { cwd: process.cwd() }

export function getContext(): Context {
  return currentContext
}

export function setContext(ctx: Partial<Context>): void {
  currentContext = { ...currentContext, ...ctx }
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export { CAPPED_DEFAULT_MAX_TOKENS, COMPACT_MAX_OUTPUT_TOKENS, ESCALATED_MAX_TOKENS, MODEL_CONTEXT_WINDOW_DEFAULT, calculateContextPercentages, getContextWindowForModel, getMaxThinkingTokensForModel, getModelMaxOutputTokens, getSonnet1mExpTreatmentEnabled, has1mContext, is1mContextDisabled, modelSupports1M } from "../shared/utils/context.js";
