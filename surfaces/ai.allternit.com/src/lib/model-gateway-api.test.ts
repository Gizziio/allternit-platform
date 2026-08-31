import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '@/integration/api-client';
import {
  listModelGatewayModels,
  sendModelGatewayResponse,
  resolveAutoModel,
  loadModelAutoPolicy,
  saveModelAutoPolicy,
  type ModelGatewayModel,
  type ModelAutoPolicy,
} from './model-gateway-api';

vi.mock('@/integration/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  GATEWAY_BASE_URL: 'http://localhost:8013',
}));

const mockApi = vi.mocked(api);

function makeModel(overrides: Partial<ModelGatewayModel> = {}): ModelGatewayModel {
  return {
    id: 'openai/gpt-4o-mini',
    object: 'model',
    created: 0,
    owned_by: 'openai',
    display_name: 'GPT-4o mini',
    context_window: 128_000,
    quality_tier: 'fast',
    pricing: { input_cents_per_1m: 15, output_cents_per_1m: 60 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('model-gateway-api', () => {
  it('listModelGatewayModels calls /v1/models', async () => {
    const data: ModelGatewayModel[] = [makeModel()];
    mockApi.get.mockResolvedValue({ object: 'list', data });

    const models = await listModelGatewayModels();

    expect(mockApi.get).toHaveBeenCalledWith('/v1/models');
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('openai/gpt-4o-mini');
  });

  it('sendModelGatewayResponse posts to /v1/responses', async () => {
    mockApi.post.mockResolvedValue({
      id: 'resp-1',
      object: 'chat.completion',
      created: 1,
      model: 'openai/gpt-4o-mini',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
      cost_cents: 1,
      organization_id: 'org-1',
    });

    const result = await sendModelGatewayResponse({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 100,
    });

    expect(mockApi.post).toHaveBeenCalledWith('/v1/responses', {
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 100,
    });
    expect(result.model).toBe('openai/gpt-4o-mini');
    expect(result.cost_cents).toBe(1);
  });
});

describe('resolveAutoModel', () => {
  const models: ModelGatewayModel[] = [
    makeModel({ id: 'openai/gpt-4o-mini', owned_by: 'openai', quality_tier: 'fast', context_window: 128_000, pricing: { input_cents_per_1m: 15, output_cents_per_1m: 60 } }),
    makeModel({ id: 'openai/gpt-4o', owned_by: 'openai', quality_tier: 'high', context_window: 128_000, pricing: { input_cents_per_1m: 250, output_cents_per_1m: 1000 } }),
    makeModel({ id: 'together/llama-8b', owned_by: 'together', quality_tier: 'fast', context_window: 131_072, pricing: { input_cents_per_1m: 18, output_cents_per_1m: 18 } }),
    makeModel({ id: 'fireworks/deepseek-r1', owned_by: 'fireworks', quality_tier: 'reasoning', context_window: 131_072, pricing: { input_cents_per_1m: 80, output_cents_per_1m: 240 } }),
  ];

  it('returns null for manual strategy', () => {
    expect(resolveAutoModel(models, { strategy: 'manual', allowedProviders: [], maxInputCentsPer1m: null, maxOutputCentsPer1m: null })).toBeNull();
  });

  it('picks cheapest by total price', () => {
    const id = resolveAutoModel(models, { strategy: 'cheapest', allowedProviders: [], maxInputCentsPer1m: null, maxOutputCentsPer1m: null });
    expect(id).toBe('together/llama-8b');
  });

  it('picks strongest by quality tier', () => {
    const id = resolveAutoModel(models, { strategy: 'strongest', allowedProviders: [], maxInputCentsPer1m: null, maxOutputCentsPer1m: null });
    expect(id).toBe('fireworks/deepseek-r1');
  });

  it('picks fastest by input price then tier', () => {
    const id = resolveAutoModel(models, { strategy: 'fastest', allowedProviders: [], maxInputCentsPer1m: null, maxOutputCentsPer1m: null });
    expect(id).toBe('openai/gpt-4o-mini');
  });

  it('filters by provider', () => {
    const id = resolveAutoModel(models, { strategy: 'cheapest', allowedProviders: ['together'], maxInputCentsPer1m: null, maxOutputCentsPer1m: null });
    expect(id).toBe('together/llama-8b');
  });

  it('filters by max price', () => {
    const id = resolveAutoModel(models, { strategy: 'strongest', allowedProviders: [], maxInputCentsPer1m: null, maxOutputCentsPer1m: 100 });
    expect(id).toBe('together/llama-8b');
  });

  it('returns null when no model matches', () => {
    const id = resolveAutoModel(models, { strategy: 'cheapest', allowedProviders: ['openai'], maxInputCentsPer1m: 10, maxOutputCentsPer1m: null });
    expect(id).toBeNull();
  });
});

describe('model auto policy storage', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads default policy when nothing is stored', () => {
    const policy = loadModelAutoPolicy();
    expect(policy.strategy).toBe('manual');
    expect(policy.allowedProviders).toEqual([]);
  });

  it('round-trips policy through localStorage', () => {
    const expected: ModelAutoPolicy = {
      strategy: 'balanced',
      allowedProviders: ['openai', 'anthropic'],
      maxInputCentsPer1m: 100,
      maxOutputCentsPer1m: 500,
    };
    saveModelAutoPolicy(expected);
    expect(loadModelAutoPolicy()).toEqual(expected);
  });

  it('ignores corrupted storage', () => {
    store['allternit:model-gateway:auto-policy'] = 'not-json';
    const policy = loadModelAutoPolicy();
    expect(policy.strategy).toBe('manual');
  });
});
