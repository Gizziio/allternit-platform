import { describe, it, expect } from 'bun:test';
import { getModelMetadata, MODEL_REGISTRY } from '../model-registry';

describe('model registry', () => {
  it('returns metadata for known models', () => {
    const sonnet = getModelMetadata('anthropic', 'claude-3-5-sonnet-20241022');
    expect(sonnet).toEqual({ contextWindow: 200_000, maxOutputTokens: 8_192 });

    const gpt4o = getModelMetadata('openai', 'gpt-4o');
    expect(gpt4o).toEqual({ contextWindow: 128_000, maxOutputTokens: 16_384 });
  });

  it('normalizes provider and model casing', () => {
    expect(getModelMetadata('ANTHROPIC', 'Claude-3-5-Sonnet-20241022')).toEqual(
      getModelMetadata('anthropic', 'claude-3-5-sonnet-20241022')
    );
  });

  it('returns undefined for unknown models', () => {
    expect(getModelMetadata('openai', 'unknown-model')).toBeUndefined();
    expect(getModelMetadata('unknown-provider', 'gpt-4o')).toBeUndefined();
  });

  it('contains expected providers', () => {
    expect(Object.keys(MODEL_REGISTRY).sort()).toEqual(
      expect.arrayContaining(['anthropic', 'openai', 'google', 'kimi', 'ollama'])
    );
  });
});
