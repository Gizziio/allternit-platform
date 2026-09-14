/**
 * Video provider key management hook.
 *
 * Mirrors the image-provider auth pattern. Keys are stored in the browser
 * under `allternit_video_api_keys` so the video plugin can read them.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getVideoProviders,
  VIDEO_PROVIDERS,
  type VideoProviderApiKeys,
  type VideoProviderId,
  type VideoProviderInfo,
} from '@/lib/agents/modes/video-generation';

const STORAGE_KEY = 'allternit_video_api_keys';

function readKeys(): VideoProviderApiKeys {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as VideoProviderApiKeys;
  } catch {
    return {};
  }
}

function writeKeys(keys: VideoProviderApiKeys): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  window.dispatchEvent(new CustomEvent('allternit:video-api-keys-changed', { detail: keys }));
}

export interface VideoProviderAuthState extends VideoProviderInfo {
  configured: boolean;
}

export interface UseVideoProviderAuthReturn {
  keys: VideoProviderApiKeys;
  providers: VideoProviderAuthState[];
  updateKeys: (patch: Partial<VideoProviderApiKeys>) => void;
  removeKey: (key: keyof VideoProviderApiKeys) => void;
  isConfigured: (providerId: VideoProviderId) => boolean;
}

export function useVideoProviderAuth(): UseVideoProviderAuthReturn {
  const [keys, setKeys] = useState<VideoProviderApiKeys>(readKeys);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setKeys(readKeys());
    };
    const onCustom = (event: CustomEvent<VideoProviderApiKeys>) => {
      setKeys(event.detail);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('allternit:video-api-keys-changed' as any, onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('allternit:video-api-keys-changed' as any, onCustom);
    };
  }, []);

  const updateKeys = useCallback((patch: Partial<VideoProviderApiKeys>) => {
    const next = { ...readKeys(), ...patch };
    (Object.keys(next) as Array<keyof VideoProviderApiKeys>).forEach((k) => {
      if (next[k] === '') delete next[k];
    });
    setKeys(next);
    writeKeys(next);
  }, []);

  const removeKey = useCallback((key: keyof VideoProviderApiKeys) => {
    const next = { ...readKeys() };
    delete next[key];
    setKeys(next);
    writeKeys(next);
  }, []);

  const isConfigured = useCallback(
    (providerId: VideoProviderId) =>
      VIDEO_PROVIDERS[providerId].type === 'free' ||
      VIDEO_PROVIDERS[providerId].type === 'local' ||
      getVideoProviders(keys).find((p) => p.id === providerId)?.isAvailable === true,
    [keys],
  );

  const providers = getVideoProviders(keys).map((provider) => ({
    ...provider,
    configured: isConfigured(provider.id),
  }));

  return {
    keys,
    providers,
    updateKeys,
    removeKey,
    isConfigured,
  };
}
