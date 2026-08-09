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
      expect.arrayContaining(['anthropic', 'openai', 'google', 'vertex', 'kimi', 'ollama'])
    );
  });

  it('returns Vertex model metadata', () => {
    expect(getModelMetadata('vertex', 'gemini-1.5-pro')).toEqual({
      contextWindow: 2_097_152,
      maxOutputTokens: 8_192,
    });
    expect(getModelMetadata('vertex', 'gemini-1.5-flash')).toEqual({
      contextWindow: 1_048_576,
      maxOutputTokens: 8_192,
    });
  });

  it('returns deprecation and replacement metadata', () => {
    const metadata = getModelMetadata('vertex', 'gemini-1.0-pro');
    expect(metadata).toEqual({
      contextWindow: 32_760,
      maxOutputTokens: 8_192,
      deprecated: true,
      replacement: 'gemini-1.5-pro',
    });
  });
});
