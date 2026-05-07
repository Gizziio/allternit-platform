"use client";

import { useEffect, useRef } from 'react';
import { useCodeModeStore } from '@/views/code/CodeModeStore';

interface FilesTouchedUpdate {
  modifiedFiles: string[];
  recentCommits: Array<{ hash: string; message: string; files: string[] }>;
}

/**
 * Streams file changes from the backend via Server-Sent Events and updates
 * the session's `files_touched` field in the store.
 *
 * Replaces HTTP polling with a persistent SSE connection.
 */
export function useFilesTouched(
  workspacePath: string | undefined,
  sessionId: string | undefined,
) {
  const updateSessionFilesTouched = useCodeModeStore((s) => s.updateSessionFilesTouched);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!workspacePath || !sessionId) return;

    const es = new EventSource(
      `/api/h5i/files-touched-stream?workspacePath=${encodeURIComponent(workspacePath)}`,
    );
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as { type: string } & Partial<FilesTouchedUpdate>;
        if (msg.type !== 'update') return;

        const allFiles = Array.from(
          new Set([
            ...(msg.modifiedFiles ?? []),
            ...(msg.recentCommits?.flatMap((c) => c.files) ?? []),
          ]),
        );
        if (allFiles.length > 0) {
          updateSessionFilesTouched(sessionId, allFiles);
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      // SSE will auto-reconnect; no action needed
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [workspacePath, sessionId, updateSessionFilesTouched]);
}
