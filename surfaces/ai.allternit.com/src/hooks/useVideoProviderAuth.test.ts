import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVideoProviderAuth } from './useVideoProviderAuth';

const STORAGE_KEY = 'allternit_video_api_keys';

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

describe('useVideoProviderAuth', () => {
  it('starts with keys from localStorage', () => {
    const storage = createStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ replicate: 'r8-test' }));
    vi.stubGlobal('localStorage', storage);

    const { result } = renderHook(() => useVideoProviderAuth());

    expect(result.current.keys.replicate).toBe('r8-test');
    expect(result.current.isConfigured('replicate')).toBe(true);
    expect(result.current.isConfigured('pollinations')).toBe(true);
  });

  it('updates keys and persists them', () => {
    const storage = createStorage();
    vi.stubGlobal('localStorage', storage);

    const { result } = renderHook(() => useVideoProviderAuth());

    act(() => {
      result.current.updateKeys({ fal: 'fal-test' });
    });

    expect(result.current.keys.fal).toBe('fal-test');
    expect(result.current.isConfigured('fal')).toBe(true);
    expect(JSON.parse(storage.getItem(STORAGE_KEY) || '{}').fal).toBe('fal-test');
  });

  it('removes keys', () => {
    const storage = createStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ replicate: 'r8-test' }));
    vi.stubGlobal('localStorage', storage);

    const { result } = renderHook(() => useVideoProviderAuth());

    act(() => {
      result.current.removeKey('replicate');
    });

    expect(result.current.keys.replicate).toBeUndefined();
    expect(result.current.isConfigured('replicate')).toBe(false);
  });

  it('requires both custom base URL and key for custom provider', () => {
    const storage = createStorage();
    vi.stubGlobal('localStorage', storage);

    const { result } = renderHook(() => useVideoProviderAuth());

    act(() => {
      result.current.updateKeys({ customBaseURL: 'https://api.example.com/v1' });
    });

    expect(result.current.isConfigured('custom')).toBe(false);

    act(() => {
      result.current.updateKeys({ custom: 'sk-test' });
    });

    expect(result.current.isConfigured('custom')).toBe(true);
  });

  it('lists all providers with configured state', () => {
    const storage = createStorage();
    vi.stubGlobal('localStorage', storage);

    const { result } = renderHook(() => useVideoProviderAuth());

    const replicate = result.current.providers.find((p) => p.id === 'replicate');
    expect(replicate).toBeDefined();
    expect(replicate?.configured).toBe(false);

    act(() => {
      result.current.updateKeys({ replicate: 'r8-test' });
    });

    expect(result.current.providers.find((p) => p.id === 'replicate')?.configured).toBe(true);
  });
});
