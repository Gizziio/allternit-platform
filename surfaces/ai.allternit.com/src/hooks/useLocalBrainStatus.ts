"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

export interface LocalBrainStatus {
  ollamaRunning: boolean;
  modelReady: boolean;
  checking: boolean;
  /** True the first time Ollama is detected running after it was previously not running */
  justDetected: boolean;
}

/**
 * Polls /api/local-brain on mount, window focus, and tab visibility change.
 * Provides a `justDetected` flag for when Ollama appears after being absent
 * (used to surface the post-install nudge).
 */
export function useLocalBrainStatus({ pollOnFocus = true } = {}): LocalBrainStatus & { refresh: () => void; clearJustDetected: () => void } {
  const [status, setStatus] = useState<Omit<LocalBrainStatus, 'justDetected'>>({
    ollamaRunning: false,
    modelReady: false,
    checking: true,
  });
  const [justDetected, setJustDetected] = useState(false);
  const prevRunning = useRef(false);
  const hasMounted = useRef(false);

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/local-brain');
      if (!res.ok) {
        setStatus(s => ({ ...s, checking: false }));
        return;
      }
      const data = await res.json() as { ollamaRunning: boolean; modelReady: boolean };
      setStatus({ ...data, checking: false });

      // Detect Ollama appearing for the first time (post-install nudge)
      if (hasMounted.current && data.ollamaRunning && !prevRunning.current) {
        setJustDetected(true);
      }
      prevRunning.current = data.ollamaRunning;
      hasMounted.current = true;
    } catch {
      setStatus(s => ({ ...s, checking: false }));
    }
  }, []);

  const clearJustDetected = useCallback(() => setJustDetected(false), []);

  useEffect(() => {
    check();
    if (!pollOnFocus) return;

    const handleVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', handleVisible);

    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [check, pollOnFocus]);

  return { ...status, justDetected, refresh: check, clearJustDetected };
}
