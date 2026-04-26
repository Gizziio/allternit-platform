/**
 * Automatic model router for AllternitHarness.
 *
 * Builds a tier map from whatever provider keys are present in BYOKConfig,
 * then scores each request and returns the right provider+model.
 * Zero configuration required — callers just pass provider: "auto".
 */

import type { BYOKConfig, Message, Tool } from './types.js';

export type Tier = 'simple' | 'standard' | 'complex' | 'reasoning';

export interface TierMap {
  simple:    { provider: string; model: string };
  standard:  { provider: string; model: string };
  complex:   { provider: string; model: string };
  reasoning: { provider: string; model: string };
}

// Cost-ranked model ladders per provider, cheapest first.
// These are updated here as new models release — one place, everything benefits.
const PROVIDER_LADDERS: Record<string, { simple: string; standard: string; complex: string; reasoning: string }> = {
  anthropic: {
    simple:    'claude-haiku-4-5-20251001',
    standard:  'claude-haiku-4-5-20251001',
    complex:   'claude-sonnet-4-6',
    reasoning: 'claude-opus-4-7',
  },
  openai: {
    simple:    'gpt-4o-mini',
    standard:  'gpt-4o-mini',
    complex:   'gpt-4.1',
    reasoning: 'o4-mini',
  },
  google: {
    simple:    'gemini-2.0-flash-lite',
    standard:  'gemini-2.5-flash',
    complex:   'gemini-2.5-pro',
    reasoning: 'gemini-2.5-pro',
  },
};

// Cross-provider tier preference order — pick from first available provider.
// Prioritises the cheapest capable model across all providers you have keys for.
const CROSS_PROVIDER_PREFERENCE: Record<Tier, Array<{ provider: string; model: string }>> = {
  simple: [
    { provider: 'openai',    model: 'gpt-4o-mini' },
    { provider: 'google',    model: 'gemini-2.0-flash-lite' },
    { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  ],
  standard: [
    { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
    { provider: 'google',    model: 'gemini-2.5-flash' },
    { provider: 'openai',    model: 'gpt-4o-mini' },
  ],
  complex: [
    { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    { provider: 'openai',    model: 'gpt-4.1' },
    { provider: 'google',    model: 'gemini-2.5-pro' },
  ],
  reasoning: [
    { provider: 'openai',    model: 'o4-mini' },
    { provider: 'anthropic', model: 'claude-opus-4-7' },
    { provider: 'google',    model: 'gemini-2.5-pro' },
  ],
};

/**
 * Build a tier map from available provider keys.
 * Picks the best cross-provider option for each tier, falling back to
 * single-provider ladders if only one key is present.
 */
export function buildTierMap(keys: BYOKConfig['keys']): TierMap {
  const available = new Set(
    Object.entries(keys)
      .filter(([, v]) => !!v)
      .map(([k]) => k)
  );

  const pick = (tier: Tier): { provider: string; model: string } => {
    // Try cross-provider preference list first
    for (const candidate of CROSS_PROVIDER_PREFERENCE[tier]) {
      if (available.has(candidate.provider)) return candidate;
    }
    // Fallback: first available provider's ladder
    for (const provider of available) {
      const ladder = PROVIDER_LADDERS[provider];
      if (ladder) return { provider, model: ladder[tier] };
    }
    // Should never reach here if any key is present
    throw new Error('[allternit/router] No providers configured');
  };

  return {
    simple:    pick('simple'),
    standard:  pick('standard'),
    complex:   pick('complex'),
    reasoning: pick('reasoning'),
  };
}

// ── Embedded 23-dimension scorer (no external dependency) ─────────────────────
// Ported from Manifest's open-source scoring algorithm (MIT).
// Runs in < 2ms per request. Self-contained — no imports needed.

function scoreTokenCount(text: string): number {
  const t = text.length / 4;
  if (t < 50) return -0.5;
  if (t <= 200) return -0.5 + ((t - 50) / 150) * 0.5;
  if (t <= 500) return ((t - 200) / 300) * 0.3;
  return 0.5;
}

function scoreConditionalLogic(text: string): number {
  const patterns = [/\bif\b.*?\bthen\b/gi, /\botherwise\b/gi, /\bunless\b/gi, /\bdepending on\b/gi, /\bin case\b/gi];
  let count = 0;
  for (const p of patterns) { const m = text.match(p); if (m) count += m.length; }
  return count === 0 ? 0 : count === 1 ? 0.3 : count === 2 ? 0.6 : 0.9;
}

function scoreCodeToProse(text: string): number {
  if (!text.length) return 0;
  let code = 0;
  for (const m of text.matchAll(/```[\s\S]*?(?:```|$)/g)) code += m[0].replace(/^```[^\n]*\n?/, '').replace(/```$/, '').length;
  for (const m of text.matchAll(/`([^`]+)`/g)) code += m[1].length * 0.5;
  return code === 0 ? 0 : Math.min(0.9, (code / text.length) * 1.5);
}

function scoreExpectedOutputLength(text: string): number {
  const signals = ['comprehensive', 'detailed', 'thorough', 'exhaustive', 'in-depth', 'full report', 'complete guide'];
  let n = 0;
  const l = text.toLowerCase();
  for (const s of signals) if (l.includes(s)) n++;
  return n === 0 ? 0 : n === 1 ? 0.3 : 0.6;
}

function scoreConversationDepth(count: number): number {
  if (count <= 2) return 0;
  if (count <= 5) return 0.1;
  if (count <= 10) return 0.3;
  if (count <= 20) return 0.5;
  return 0.7;
}

function scoreToolCount(toolCount: number): number {
  if (toolCount === 0) return 0;
  if (toolCount <= 2) return 0.1;
  if (toolCount <= 5) return 0.3;
  if (toolCount <= 10) return 0.6;
  return 0.9;
}

const COMPLEX_KW = ['implement', 'refactor', 'architect', 'debug', 'algorithm', 'optimize', 'design', 'analyze', 'migrate', 'deploy', 'kubernetes', 'distributed', 'microservice', 'authentication', 'encryption', 'pipeline'];
const REASONING_KW = ['prove', 'theorem', 'derive', 'axiom', 'formally verify', 'conjecture', 'induction', 'deduction', 'contradiction', 'satisfiability'];
const SIMPLE_KW = ['hi', 'hello', 'hey', 'thanks', 'thank you', 'yes', 'no', 'ok', 'okay', 'sure', 'what is', 'define', 'translate'];

function kwScore(text: string, kws: string[]): number {
  const l = text.toLowerCase();
  let hits = 0;
  for (const kw of kws) if (l.includes(kw)) hits++;
  return Math.min(1, hits / 3);
}

/**
 * Score a request and return the appropriate tier.
 * Processes only the last 3 user messages for speed.
 */
export function scoreMessages(messages: Message[], tools?: Tool[]): Tier {
  const userMessages = messages.filter(m => m.role === 'user').slice(-3);
  if (userMessages.length === 0) return 'standard';

  const lastText = typeof userMessages[userMessages.length - 1].content === 'string'
    ? userMessages[userMessages.length - 1].content as string
    : '';

  // Fast-path: short message with no complex signals → simple
  if (lastText.length < 50 && kwScore(lastText, SIMPLE_KW) > 0) return 'simple';
  if (lastText.length < 50 && kwScore(lastText, COMPLEX_KW) === 0 && kwScore(lastText, REASONING_KW) === 0) return 'simple';

  // Reasoning fast-path
  if (kwScore(lastText, REASONING_KW) > 0.3) return 'reasoning';

  // Full score
  const combined = userMessages.map(m =>
    typeof m.content === 'string' ? m.content : (m.content as Array<{type: string; text?: string}>)
      .filter(b => b.type === 'text').map(b => b.text ?? '').join(' ')
  ).join('\n');

  let score = 0;
  score += scoreTokenCount(combined) * 0.05;
  score += scoreConditionalLogic(combined) * 0.03;
  score += scoreCodeToProse(combined) * 0.02;
  score += scoreExpectedOutputLength(combined) * 0.04;
  score += scoreConversationDepth(messages.filter(m => m.role !== 'system').length) * 0.03;
  score += scoreToolCount(tools?.length ?? 0) * 0.04;
  score += kwScore(combined, COMPLEX_KW) * 0.12;
  score += kwScore(combined, REASONING_KW) * 0.07;
  score -= kwScore(combined, SIMPLE_KW) * 0.08;

  // boundaries: simple < -0.1, standard < 0.08, complex < 0.35, reasoning ≥ 0.35
  if (score < -0.1) return 'simple';
  if (score < 0.08) return 'standard';
  if (score < 0.35) return 'complex';
  return 'reasoning';
}
