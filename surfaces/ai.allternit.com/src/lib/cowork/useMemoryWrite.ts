'use client';

import { useCallback } from 'react';

interface MemoryWriteOptions {
  content: string;
  type?: 'fact' | 'preference' | 'skill' | 'context';
  tags?: string[];
  source?: string;
  userId?: string;
  projectId?: string;
  sessionId?: string;
}

export function useMemoryWrite() {
  const writeMemory = useCallback((opts: MemoryWriteOptions) => {
    fetch('/api/v1/cowork/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(opts.userId ? { userId: opts.userId } : {}),
        content: opts.content,
        type: opts.type ?? 'context',
        tags: opts.tags ?? [],
        source: opts.source ?? 'client',
        projectId: opts.projectId,
        sessionId: opts.sessionId,
      }),
    }).catch(() => {});
  }, []);

  return { writeMemory };
}
