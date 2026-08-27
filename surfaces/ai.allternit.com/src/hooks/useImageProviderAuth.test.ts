import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImageProviderAuth } from './useImageProviderAuth';

const STORAGE_KEY = 'allternit_image_api_keys';

function createStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useImageProviderAuth', () => {
  it('starts with keys from localStorage', () => {
    const storage = createStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ openai: 'sk-test' }));
    vi.stubGlobal('localStorage', storage);

    const { result } = renderHook(() => useImageProviderAuth());

    expect(result.current.keys.openai).toBe('sk-test');
    expect(result.current.isConfigured('openai')).toBe(true);
    expect(result.current.isConfigured('pollinations')).toBe(true);
  });

  it('updates keys and persists them', () => {
    const storage = createStorage();
    vi.stubGlobal('localStorage', storage);

    const { result } = renderHook(() => useImageProviderAuth());

    act(() => {
      result.current.updateKeys({ huggingface: 'hf-test' });
    });

    expect(result.current.keys.huggingface).toBe('hf-test');
    expect(result.current.isConfigured('huggingface')).toBe(true);
    expect(JSON.parse(storage.getItem(STORAGE_KEY) || '{}').huggingface).toBe('hf-test');
  });

  it('removes keys', () => {
    const storage = createStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ openai: 'sk-test' }));
    vi.stubGlobal('localStorage', storage);

    const { result } = renderHook(() => useImageProviderAuth());

    act(() => {
      result.current.removeKey('openai');
    });

    expect(result.current.keys.openai).toBeUndefined();
    expect(result.current.isConfigured('openai')).toBe(false);
  });

  it('requires both cloudflare account id and token', () => {
    const storage = createStorage();
    vi.stubGlobal('localStorage', storage);

    const { result } = renderHook(() => useImageProviderAuth());

    act(() => {
      result.current.updateKeys({ cloudflareAccountId: 'account' });
    });

    expect(result.current.isConfigured('cloudflare')).toBe(false);

    act(() => {
      result.current.updateKeys({ cloudflareToken: 'token' });
    });

    expect(result.current.isConfigured('cloudflare')).toBe(true);
  });

  it('lists all providers with configured state', () => {
    const storage = createStorage();
    vi.stubGlobal('localStorage', storage);

    const { result } = renderHook(() => useImageProviderAuth());

    const openai = result.current.providers.find((p) => p.id === 'openai');
    expect(openai).toBeDefined();
    expect(openai?.configured).toBe(false);

    act(() => {
      result.current.updateKeys({ openai: 'sk-test' });
    });

    expect(result.current.providers.find((p) => p.id === 'openai')?.configured).toBe(true);
  });
});
