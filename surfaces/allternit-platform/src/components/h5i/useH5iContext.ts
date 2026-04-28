"use client";

import { useEffect, useRef } from 'react';
import { startH5iContext, finishH5iContext, generateSessionSummary } from '@/lib/h5i/client';

/**
 * Manages h5i context lifecycle for a canvas session tile.
 * Automatically starts context when the session becomes active
 * and finishes it (with auto-summarization) when the component unmounts.
 */
export function useH5iContext(
  workspacePath: string | undefined,
  sessionId: string | undefined,
  goal: string,
) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (!workspacePath || !sessionId || startedRef.current) return;

    async function init() {
      try {
        await startH5iContext(workspacePath!, sessionId!, goal);
        startedRef.current = true;
      } catch {
        // h5i may not be installed — silently fail
      }
    }

    void init();

    return () => {
      if (startedRef.current && workspacePath && sessionId) {
        void (async () => {
          try {
            // Finish context first
            await finishH5iContext(workspacePath, sessionId);
            // Then auto-generate summary
            await generateSessionSummary(workspacePath, sessionId);
          } catch {
            // Best-effort cleanup
          }
        })();
      }
    };
  }, [workspacePath, sessionId, goal]);
}
