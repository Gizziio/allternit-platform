/**
 * Model Gateway API client.
 *
 * Typed wrappers around the OpenAI-shaped Fabric Model Gateway endpoints
 * (`/v1/models`, `/v1/responses`). These routes are proxied by the platform
 * gateway so the surface can treat them like any other authenticated API call.
 */

import { api, GATEWAY_BASE_URL } from '@/integration/api-client';

// ============================================================================
// Types
// ============================================================================

export interface ModelGatewayModel {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  display_name: string;
  context_window: number;
  quality_tier: string;
  pricing: {
    input_cents_per_1m: number;
    output_cents_per_1m: number;
  };
}

export interface ModelListResponse {
  object: 'list';
  data: ModelGatewayModel[];
}

export interface ModelGatewayMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ModelGatewayRequest {
  model: string;
  messages: ModelGatewayMessage[];
  max_tokens?: number;
  temperature?: number;
}

export interface ModelGatewayUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ModelGatewayChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

export interface ModelGatewayResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ModelGatewayChoice[];
  usage: ModelGatewayUsage;
  cost_cents: number;
  organization_id: string;
}

// ============================================================================
// API calls
// ============================================================================

export async function listModelGatewayModels(): Promise<ModelGatewayModel[]> {
  const result = await api.get<ModelListResponse>('/v1/models');
  return result.data ?? [];
}

export async function sendModelGatewayResponse(
  request: ModelGatewayRequest,
): Promise<ModelGatewayResponse> {
  return api.post<ModelGatewayResponse>('/v1/responses', request);
}

export function getModelGatewayEndpoint(): string {
  return `${GATEWAY_BASE_URL}/v1`;
}

export function getModelGatewayToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('allternit_token');
}

// ============================================================================
// Model=auto policy
// ============================================================================

export type AutoPolicyStrategy = 'manual' | 'cheapest' | 'fastest' | 'strongest' | 'balanced';

export interface ModelAutoPolicy {
  strategy: AutoPolicyStrategy;
  allowedProviders: string[];
  maxInputCentsPer1m: number | null;
  maxOutputCentsPer1m: number | null;
}

const POLICY_STORAGE_KEY = 'allternit:model-gateway:auto-policy';

const DEFAULT_POLICY: ModelAutoPolicy = {
  strategy: 'manual',
  allowedProviders: [],
  maxInputCentsPer1m: null,
  maxOutputCentsPer1m: null,
};

export function loadModelAutoPolicy(): ModelAutoPolicy {
  if (typeof window === 'undefined') return DEFAULT_POLICY;
  try {
    const raw = localStorage.getItem(POLICY_STORAGE_KEY);
    if (!raw) return DEFAULT_POLICY;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_POLICY;
    const p = parsed as Partial<ModelAutoPolicy>;
    return {
      strategy: isAutoPolicyStrategy(p.strategy) ? p.strategy : DEFAULT_POLICY.strategy,
      allowedProviders: Array.isArray(p.allowedProviders)
        ? p.allowedProviders.filter((x): x is string => typeof x === 'string')
        : DEFAULT_POLICY.allowedProviders,
      maxInputCentsPer1m:
        typeof p.maxInputCentsPer1m === 'number' || p.maxInputCentsPer1m === null
          ? p.maxInputCentsPer1m
          : DEFAULT_POLICY.maxInputCentsPer1m,
      maxOutputCentsPer1m:
        typeof p.maxOutputCentsPer1m === 'number' || p.maxOutputCentsPer1m === null
          ? p.maxOutputCentsPer1m
          : DEFAULT_POLICY.maxOutputCentsPer1m,
    };
  } catch {
    return DEFAULT_POLICY;
  }
}

export function saveModelAutoPolicy(policy: ModelAutoPolicy): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(policy));
}

function isAutoPolicyStrategy(value: unknown): value is AutoPolicyStrategy {
  return (
    typeof value === 'string' &&
    ['manual', 'cheapest', 'fastest', 'strongest', 'balanced'].includes(value)
  );
}

const TIER_RANK: Record<string, number> = {
  reasoning: 3,
  high: 2,
  fast: 1,
};

function tierRank(tier: string): number {
  return TIER_RANK[tier.toLowerCase()] ?? 0;
}

/**
 * Resolve a concrete model id from the catalog using the active auto policy.
 * Returns `null` when the policy is manual or no model satisfies the policy.
 */
export function resolveAutoModel(
  models: ModelGatewayModel[],
  policy: ModelAutoPolicy,
): string | null {
  if (policy.strategy === 'manual' || models.length === 0) return null;

  let candidates = models.slice();

  if (policy.allowedProviders.length > 0) {
    candidates = candidates.filter((m) => policy.allowedProviders.includes(m.owned_by));
  }

  if (policy.maxInputCentsPer1m != null) {
    candidates = candidates.filter((m) => m.pricing.input_cents_per_1m <= policy.maxInputCentsPer1m!);
  }
  if (policy.maxOutputCentsPer1m != null) {
    candidates = candidates.filter((m) => m.pricing.output_cents_per_1m <= policy.maxOutputCentsPer1m!);
  }

  if (candidates.length === 0) return null;

  switch (policy.strategy) {
    case 'cheapest':
      candidates.sort(
        (a, b) =>
          a.pricing.input_cents_per_1m +
          a.pricing.output_cents_per_1m -
          (b.pricing.input_cents_per_1m + b.pricing.output_cents_per_1m),
      );
      break;
    case 'fastest':
      candidates.sort(
        (a, b) =>
          a.pricing.input_cents_per_1m - b.pricing.input_cents_per_1m ||
          tierRank(b.quality_tier) - tierRank(a.quality_tier),
      );
      break;
    case 'strongest':
      candidates.sort(
        (a, b) =>
          tierRank(b.quality_tier) - tierRank(a.quality_tier) ||
          b.context_window - a.context_window ||
          a.pricing.input_cents_per_1m - b.pricing.input_cents_per_1m,
      );
      break;
    case 'balanced':
      candidates.sort(
        (a, b) =>
          tierRank(b.quality_tier) - tierRank(a.quality_tier) ||
          a.pricing.input_cents_per_1m +
          a.pricing.output_cents_per_1m -
          (b.pricing.input_cents_per_1m + b.pricing.output_cents_per_1m),
      );
      break;
    default:
      return null;
  }

  return candidates[0]?.id ?? null;
}
