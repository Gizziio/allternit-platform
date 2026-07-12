'use client';

import { useState } from 'react';

const STORAGE_PREFIX = 'allternit.settings.v1.';

/**
 * useState that persists to localStorage under `allternit.settings.v1.<key>`.
 * Drop-in replacement: same [value, setValue] tuple, JSON-serialized values.
 * Falls back to in-memory state when storage is unavailable.
 */
export function useSettingsState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  const setPersistedValue: React.Dispatch<React.SetStateAction<T>> = (next) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
      try {
        window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(resolved));
      } catch {
        // storage full or unavailable — keep the in-memory update
      }
      return resolved;
    });
  };

  return [value, setPersistedValue];
}
