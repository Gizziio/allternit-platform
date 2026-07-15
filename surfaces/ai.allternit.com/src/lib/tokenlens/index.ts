/**
 * TokenLens - Token usage tracking and cost estimation utilities
 * 
 * This module provides functions for:
 * - Estimating token counts from text
 * - Calculating usage statistics
 * - Tracking model context limits
 * - Estimating API costs
 */

import type { LanguageModelUsage } from "ai";
import { models as generatedModels } from "@/lib/ai/models.generated";

interface PricingEntry { input: number; output: number; cacheRead?: number; cacheWrite?: number }

// Legacy pricing per 1M tokens, kept only as a fallback for old cached
// bare-name model ids (e.g. sessions persisted before gateway-namespaced ids
// existed). Current models are priced from the registry below — never add
// new entries here, they immediately start rotting.
const LEGACY_MODEL_PRICING: Record<string, PricingEntry> = {
  "gpt-4": { input: 30, output: 60 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-4o": { input: 5, output: 15, cacheRead: 1.25, cacheWrite: 5 },
  "gpt-4o-mini": { input: 0.15, output: 0.6, cacheRead: 0.0375, cacheWrite: 0.15 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  "claude-3-opus": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  "claude-3-sonnet": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-3-haiku": { input: 0.25, output: 1.25, cacheRead: 0.03, cacheWrite: 0.3125 },
  "claude-3-5-sonnet": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "gemini-pro": { input: 0.5, output: 1.5 },
  "gemini-ultra": { input: 1, output: 3 },
  "default": { input: 1, output: 2 },
};

interface GeneratedPricingModel {
  id: string;
  context_window?: number;
  max_tokens?: number;
  pricing?: { input?: string; output?: string; input_cache_read?: string; input_cache_write?: string };
}

function perMillion(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n * 1_000_000 : undefined;
}

// Registry-derived pricing/context tables, keyed both by the full gateway id
// ("openai/gpt-5-mini") and its bare suffix ("gpt-5-mini") since callers pass
// either form.
const REGISTRY_PRICING = new Map<string, PricingEntry>();
const REGISTRY_CONTEXT = new Map<string, number>();
for (const m of generatedModels as readonly GeneratedPricingModel[]) {
  const input = perMillion(m.pricing?.input);
  const output = perMillion(m.pricing?.output);
  if (input !== undefined && output !== undefined) {
    const entry: PricingEntry = {
      input,
      output,
      cacheRead: perMillion(m.pricing?.input_cache_read),
      cacheWrite: perMillion(m.pricing?.input_cache_write),
    };
    REGISTRY_PRICING.set(m.id, entry);
    REGISTRY_PRICING.set(m.id.split('/').pop()!, entry);
  }
  const context = m.context_window ?? m.max_tokens;
  if (context) {
    REGISTRY_CONTEXT.set(m.id, context);
    REGISTRY_CONTEXT.set(m.id.split('/').pop()!, context);
  }
}

/**
 * Estimate the number of tokens in a text string
 * Rough approximation: ~4 characters per token for English text
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface EstimatedLanguageModelUsage extends LanguageModelUsage {
  estimated: true;
  estimationMethod: "chars_div_4";
}

/**
 * Get pricing for a model
 */
function getModelPricing(modelId?: string): PricingEntry {
  if (!modelId) return LEGACY_MODEL_PRICING.default;

  const exact = REGISTRY_PRICING.get(modelId) ?? REGISTRY_PRICING.get(modelId.split('/').pop()!);
  if (exact) return exact;

  // Fallback for old cached bare-name ids that predate gateway namespacing.
  const legacyKey = Object.keys(LEGACY_MODEL_PRICING).find((key) =>
    modelId.toLowerCase().includes(key.toLowerCase())
  );
  return legacyKey ? LEGACY_MODEL_PRICING[legacyKey] : LEGACY_MODEL_PRICING.default;
}

/**
 * Calculate cost in USD from token counts
 */
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  modelId?: string,
  cacheReads?: number,
  reasoningTokens?: number
): { inputUSD: number; outputUSD: number; cacheUSD?: number; reasoningUSD?: number; totalUSD: number } {
  const pricing = getModelPricing(modelId);
  
  // Pricing is per 1M tokens
  const inputUSD = (inputTokens / 1_000_000) * pricing.input;
  const outputUSD = (outputTokens / 1_000_000) * pricing.output;
  
  let cacheUSD = 0;
  if (cacheReads && pricing.cacheRead) {
    cacheUSD = (cacheReads / 1_000_000) * pricing.cacheRead;
  }
  
  let reasoningUSD = 0;
  if (reasoningTokens && pricing.input) {
    // Reasoning tokens counted at input rate
    reasoningUSD = (reasoningTokens / 1_000_000) * pricing.input;
  }
  
  return {
    inputUSD,
    outputUSD,
    cacheUSD: cacheUSD > 0 ? cacheUSD : undefined,
    reasoningUSD: reasoningUSD > 0 ? reasoningUSD : undefined,
    totalUSD: inputUSD + outputUSD + cacheUSD + reasoningUSD,
  };
}

/**
 * Flexible usage type that accepts various token count formats
 */
interface FlexibleUsage {
  input?: number;
  output?: number;
  reasoningTokens?: number;
  cacheReads?: number;
  cacheWrites?: number;
}

/**
 * Get usage statistics and cost for a model response
 * 
 * This overload accepts a flexible usage object
 */
export function getUsage(params: {
  modelId?: string;
  usage: FlexibleUsage;
}): {
  costUSD: {
    inputUSD: number;
    outputUSD: number;
    cacheUSD?: number;
    reasoningUSD?: number;
    totalUSD: number;
  };
};

/**
 * Get usage statistics for a model response
 * 
 * This overload accepts text and estimates token counts
 */
export function getUsage(params: {
  text: string;
  modelId?: string;
  maxTokens?: number;
}): EstimatedLanguageModelUsage;

/**
 * Implementation of getUsage
 */
export function getUsage(
  params: 
    | { modelId?: string; usage: FlexibleUsage }
    | { text: string; modelId?: string; maxTokens?: number }
): { costUSD: { inputUSD: number; outputUSD: number; cacheUSD?: number; reasoningUSD?: number; totalUSD: number } } | EstimatedLanguageModelUsage {
  // Check if this is the cost calculation overload
  if ("usage" in params) {
    const { modelId, usage } = params;
    const costUSD = calculateCost(
      usage.input ?? 0,
      usage.output ?? 0,
      modelId,
      usage.cacheReads,
      usage.reasoningTokens
    );
    return { costUSD } as { costUSD: { inputUSD: number; outputUSD: number; cacheUSD?: number; reasoningUSD?: number; totalUSD: number } };
  }
  
  // Otherwise it's the token estimation overload
  const { text, maxTokens = 4096 } = params;
  
  // Estimate prompt tokens from text
  const inputTokens = estimateTokenCount(text);
  
  const outputTokens = Math.min(
    Math.ceil(inputTokens * 0.5),
    maxTokens - inputTokens
  );
  
  return {
    inputTokens,
    outputTokens: Math.max(0, outputTokens),
    totalTokens: inputTokens + Math.max(0, outputTokens),
    estimated: true,
    estimationMethod: "chars_div_4",
    inputTokenDetails: {
      noCacheTokens: inputTokens,
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
    },
    outputTokenDetails: {
      textTokens: Math.max(0, outputTokens),
      reasoningTokens: undefined,
    },
  } satisfies EstimatedLanguageModelUsage;
}

/**
 * Calculate the percentage of context window used
 */
function calculateUsagePercent(
  usage: LanguageModelUsage,
  maxTokens: number
): number {
  const total = usage.totalTokens ?? 0;
  return Math.min(100, Math.round((total / maxTokens) * 100));
}

/**
 * Check if the conversation is approaching token limits
 */
function isNearTokenLimit(
  usage: LanguageModelUsage,
  maxTokens: number,
  thresholdPercent = 80
): boolean {
  const percent = calculateUsagePercent(usage, maxTokens);
  return percent >= thresholdPercent;
}

/**
 * Get max tokens for a given model
 */
// Legacy context windows, kept only as a fallback for old cached bare-name
// model ids. Current models are read from the registry (REGISTRY_CONTEXT).
const LEGACY_MODEL_LIMITS: Record<string, number> = {
  "gpt-4": 8192,
  "gpt-4-turbo": 128000,
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gpt-3.5-turbo": 16385,
  "claude-3-opus": 200000,
  "claude-3-sonnet": 200000,
  "claude-3-haiku": 200000,
  "claude-3-5-sonnet": 200000,
  "gemini-pro": 1000000,
  "gemini-ultra": 1000000,
  "default": 4096,
};

function getModelMaxTokens(modelId?: string): number {
  if (!modelId) return LEGACY_MODEL_LIMITS.default;

  const exact = REGISTRY_CONTEXT.get(modelId) ?? REGISTRY_CONTEXT.get(modelId.split('/').pop()!);
  if (exact) return exact;

  const legacyKey = Object.keys(LEGACY_MODEL_LIMITS).find((key) =>
    modelId.toLowerCase().includes(key.toLowerCase())
  );
  return legacyKey ? LEGACY_MODEL_LIMITS[legacyKey] : LEGACY_MODEL_LIMITS.default;
}
