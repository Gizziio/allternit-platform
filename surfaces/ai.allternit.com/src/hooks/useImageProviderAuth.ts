/**
 * Image provider key management hook.
 *
 * Mirrors the video-provider auth pattern but stores keys in the browser
 * (localStorage `allternit_image_api_keys`) so the image plugin can read them
 * without requiring a backend round-trip. A future migration can sync this
 * map to the runtime keychain via `/api/v1/onboarding/provider`.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getImageProviders,
  IMAGE_PROVIDERS,
  type ImageProviderApiKeys,
  type ImageProviderId,
  type ImageProviderInfo,
} from '@/lib/agents/modes/image-generation';

const STORAGE_KEY = 'allternit_image_api_keys';

function readKeys(): ImageProviderApiKeys {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as ImageProviderApiKeys;
  } catch {
    return {};
  }
}

function writeKeys(keys: ImageProviderApiKeys): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  window.dispatchEvent(new CustomEvent('allternit:image-api-keys-changed', { detail: keys }));
}

export interface ImageProviderAuthState extends ImageProviderInfo {
  configured: boolean;
}

export interface UseImageProviderAuthReturn {
  keys: ImageProviderApiKeys;
  providers: ImageProviderAuthState[];
  updateKeys: (patch: Partial<ImageProviderApiKeys>) => void;
  removeKey: (key: keyof ImageProviderApiKeys) => void;
  isConfigured: (providerId: ImageProviderId) => boolean;
  isAvailable: (providerId: ImageProviderId) => boolean;
}

export function useImageProviderAuth(): UseImageProviderAuthReturn {
  const [keys, setKeys] = useState<ImageProviderApiKeys>(readKeys);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setKeys(readKeys());
    };
    const onCustom = (event: CustomEvent<ImageProviderApiKeys>) => {
      setKeys(event.detail);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('allternit:image-api-keys-changed' as any, onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('allternit:image-api-keys-changed' as any, onCustom);
    };
  }, []);

  const updateKeys = useCallback((patch: Partial<ImageProviderApiKeys>) => {
    const next = { ...readKeys(), ...patch };
    // Drop empty strings so availability checks treat them as missing.
    (Object.keys(next) as Array<keyof ImageProviderApiKeys>).forEach((k) => {
      if (next[k] === '') delete next[k];
    });
    setKeys(next);
    writeKeys(next);
  }, []);

  const removeKey = useCallback((key: keyof ImageProviderApiKeys) => {
    const next = { ...readKeys() };
    delete next[key];
    setKeys(next);
    writeKeys(next);
  }, []);

  const isConfigured = useCallback(
    (providerId: ImageProviderId) => IMAGE_PROVIDERS[providerId].isAvailable({ apiKeys: keys }),
    [keys],
  );

  const isAvailable = useCallback(
    (providerId: ImageProviderId) => IMAGE_PROVIDERS[providerId].isAvailable({ apiKeys: keys }),
    [keys],
  );

  const providers = getImageProviders({ apiKeys: keys }).map((provider) => ({
    ...provider,
    configured: isConfigured(provider.id),
  }));

  return {
    keys,
    providers,
    updateKeys,
    removeKey,
    isConfigured,
    isAvailable,
  };
}
