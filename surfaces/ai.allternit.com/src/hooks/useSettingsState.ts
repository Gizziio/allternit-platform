'use client';

import { useEffect, useRef, useState } from 'react';

const STORAGE_PREFIX = 'allternit.settings.v1.';
const SETTINGS_CHANGED_EVENT = 'allternit:setting-changed';

/**
 * useState that persists to localStorage under `allternit.settings.v1.<key>`.
 * Drop-in replacement: same [value, setValue] tuple, JSON-serialized values.
 * Falls back to in-memory state when storage is unavailable.
 *
 * Writes dispatch `allternit:setting-changed` so other components mounted
 * elsewhere in the tree (rail, composer, providers) can re-read the value.
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
      // No-op guard: unchanged values skip setItem + event; prevents the
      // reader→writer→event→reader loop from overflowing the stack.
      if (Object.is(resolved, prev)) return prev;
      try {
        window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(resolved));
        window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: { key } }));
      } catch {
        // storage full or unavailable — keep the in-memory update
      }
      return resolved;
    });
  };

  return [value, setPersistedValue];
}

/**
 * Read a settings key reactively: initial value from localStorage, live
 * updates whenever any useSettingsState writer (or another tab) changes it.
 */
export function useSettingsValue<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useSettingsState(key, initial);
  const setValueRef = useRef(setValue);
  setValueRef.current = setValue;
  // Last value applied via reread — skip writer calls that would only
  // re-apply the identical value (defense in depth against the event loop).
  const lastAppliedRef = useRef(value);

  useEffect(() => {
    const reread = () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
        const parsed = raw === null ? initial : (JSON.parse(raw) as T);
        // Recursion guard: an unchanged parsed value means the writer that
        // fired the event already holds this state — do not call the writer.
        if (Object.is(parsed, lastAppliedRef.current)) return;
        lastAppliedRef.current = parsed;
        setValueRef.current(parsed);
      } catch {
        // keep the current in-memory value
      }
    };
    const onChanged = (event: Event) => {
      if ((event as CustomEvent).detail?.key === key) reread();
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, onChanged);
    window.addEventListener('storage', reread);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, onChanged);
      window.removeEventListener('storage', reread);
    };
  }, [key, initial]);

  return [value, setValue];
}
