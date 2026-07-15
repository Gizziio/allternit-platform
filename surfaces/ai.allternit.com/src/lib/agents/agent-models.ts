/**
 * Agent Model Catalog
 *
 * Derives the models offered during agent creation from the platform model
 * registry (`lib/ai/models.generated.ts`, the AI-gateway snapshot) and
 * `config.models` instead of a hand-maintained list — hardcoded catalogs rot
 * (they still listed gemini-1.5 and claude-3.5 long after both were retired).
 *
 * This is the static fallback; when the agents API is reachable the creation
 * form prefers its live `/api/v1/models` response.
 */

import { config } from '@/lib/config';
import { models as generatedModels } from '@/lib/ai/models.generated';
import type { CreateAgentInput } from './agent.types';

type AgentProvider = CreateAgentInput['provider'];

export interface AgentModelOption {
  id: string;
  name: string;
  provider: AgentProvider;
}

interface GeneratedModel {
  id: string;
  name: string;
  owned_by: string;
  type: string;
  created?: number;
  tags?: string[];
}

function toAgentProvider(ownedBy: string): AgentProvider {
  switch (ownedBy) {
    case 'openai': return 'openai';
    case 'anthropic': return 'anthropic';
    case 'google': return 'google';
    default: return 'custom';
  }
}

const FIRST_PARTY_PROVIDERS = new Set(['openai', 'anthropic', 'google']);
const CURATED_IDS = new Set([config.models.defaults.primary, ...config.models.curatedDefaults]);

/**
 * Tool-capable language models from the registry: every first-party provider
 * model plus curated entries from other providers (mapped to `custom`).
 */
export const AGENT_MODELS: AgentModelOption[] = (generatedModels as readonly GeneratedModel[])
  .filter((m) =>
    m.type === 'language' &&
    (m.tags ?? []).includes('tool-use') &&
    !config.models.disabledModels.includes(m.id) &&
    (FIRST_PARTY_PROVIDERS.has(m.owned_by) || CURATED_IDS.has(m.id)),
  )
  .map((m) => ({ id: m.id, name: m.name, provider: toAgentProvider(m.owned_by) }))
  .sort((a, b) => {
    const order = config.models.providerOrder;
    const ai = order.indexOf(a.provider) === -1 ? order.length : order.indexOf(a.provider);
    const bi = order.indexOf(b.provider) === -1 ? order.length : order.indexOf(b.provider);
    return ai !== bi ? ai - bi : a.id.localeCompare(b.id);
  });

/**
 * Platform-default model for new agents: `config.models.defaults.primary`,
 * falling back through the curated defaults to the first catalog entry.
 */
export function getDefaultAgentModel(): AgentModelOption {
  for (const id of [config.models.defaults.primary, ...config.models.curatedDefaults]) {
    const hit = AGENT_MODELS.find((m) => m.id === id);
    if (hit) return hit;
  }
  return AGENT_MODELS[0];
}

/**
 * Current tool-capable model for a provider: the platform's curated default
 * for that provider when one exists, otherwise the highest-versioned stable
 * (non-preview) model in the registry snapshot. The snapshot's `created`
 * field is the snapshot-generation time, not the model release date, so
 * version numbers in the id are the recency signal. Used by template presets
 * so they track the registry instead of pinning ids.
 */
// Version-like tokens only (1-2 digits, optionally .1-2 digits) so embedded
// date suffixes ("-20240620") aren't picked up as a huge fake version — the
// lookaround requires the run of digits to be at most 2 long on each side of
// the optional dot.
function versionOf(id: string): number {
  const matches = id.match(/(?<![\d.])\d{1,2}(?:\.\d{1,2})?(?![\d.])/g);
  return matches ? Math.max(...matches.map(Number)) : 0;
}

export function getLatestAgentModel(provider: AgentProvider): AgentModelOption {
  const curated = [config.models.defaults.primary, ...config.models.curatedDefaults]
    .map((id) => AGENT_MODELS.find((m) => m.id === id))
    .find((m) => m?.provider === provider);
  if (curated) return curated;

  const candidates = (generatedModels as readonly GeneratedModel[])
    .filter((m) =>
      m.type === 'language' &&
      (m.tags ?? []).includes('tool-use') &&
      toAgentProvider(m.owned_by) === provider &&
      !config.models.disabledModels.includes(m.id),
    )
    .sort((a, b) => {
      const aPreview = /preview|exp/.test(a.id) ? 1 : 0;
      const bPreview = /preview|exp/.test(b.id) ? 1 : 0;
      if (aPreview !== bPreview) return aPreview - bPreview;
      return versionOf(b.id) - versionOf(a.id);
    });
  const hit = candidates[0];
  return hit
    ? { id: hit.id, name: hit.name, provider }
    : getDefaultAgentModel();
}

// Boundary-anchored so short keywords can't match inside unrelated names
// (naive /mini/ matches "geMINIi", naive /pro/ matches embedded substrings).
const TIER_PATTERNS: Record<'flagship' | 'balanced' | 'fast', RegExp> = {
  flagship: /opus|(?:^|[/-])pro(?=$|[-.])|(?:^|[/-])o3(?=$|[-.])(?!-mini)/i,
  fast: /haiku|(?:^|[/-])mini(?=$|[-.])|(?:^|[/-])nano(?=$|[-.])|(?:^|[/-])lite(?=$|[-.])/i,
  balanced: /sonnet|flash(?![-.]?lite)|(?:^|[/-])gpt-5(?:\.\d+)?(?:-chat)?$/i,
};

// Specialized SKU families (coding-only, safety-only, etc.) are excluded from
// generic tier matching — they're not general-purpose speed/cost variants,
// even when their name happens to contain "mini" or "pro".
const SPECIALIZED_FAMILY = /codex|safeguard|deep-research/i;

/**
 * Current model for a provider at a given capability/cost tier (flagship,
 * balanced, fast) — for workflow presets and orchestrator templates that
 * assign different agent roles different model strengths (e.g. a planner
 * on the strongest model, a summarizer on the fastest). Matches naming
 * conventions shared across providers (opus/sonnet/haiku, pro/flash/lite,
 * gpt-5/mini/nano). Among multiple matches, prefers the highest version and
 * non-preview releases. Falls back to `getLatestAgentModel` if no tier match.
 */
export function getLatestAgentModelByTier(
  provider: AgentProvider,
  tier: 'flagship' | 'balanced' | 'fast',
): AgentModelOption {
  const matches = AGENT_MODELS
    .filter((m) => m.provider === provider)
    .filter((m) => TIER_PATTERNS[tier].test(m.id) && !SPECIALIZED_FAMILY.test(m.id))
    .sort((a, b) => {
      const aPreview = /preview|exp/i.test(a.id) ? 1 : 0;
      const bPreview = /preview|exp/i.test(b.id) ? 1 : 0;
      if (aPreview !== bPreview) return aPreview - bPreview;
      return versionOf(b.id) - versionOf(a.id);
    });
  return matches[0] ?? getLatestAgentModel(provider);
}
