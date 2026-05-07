'use client';

import { useState, useCallback, useRef } from 'react';

export interface ResearchMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ResearchThreadState {
  threadId: string | null;
  messages: ResearchMessage[];
  isStreaming: boolean;
  streamBuffer: string;
  error: string | null;
  isHealthy: boolean | null;
}

export function useResearchThread() {
  const [state, setState] = useState<ResearchThreadState>({
    threadId: null,
    messages: [],
    isStreaming: false,
    streamBuffer: '',
    error: null,
    isHealthy: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const ensureThread = useCallback(async (): Promise<string> => {
    if (state.threadId) return state.threadId;
    const res = await fetch('/api/v1/cowork/research/thread', { method: 'POST' });
    const data = await res.json() as { threadId?: string; error?: string };
    if (!res.ok || !data.threadId) throw new Error(data.error ?? 'Failed to create research thread');
    setState((s) => ({ ...s, threadId: data.threadId! }));
    return data.threadId!;
  }, [state.threadId]);

  const query = useCallback(async (message: string) => {
    if (state.isStreaming) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState((s) => ({
      ...s,
      isStreaming: true,
      error: null,
      streamBuffer: '',
      messages: [...s.messages, { role: 'user', content: message }],
    }));

    try {
      const threadId = await ensureThread();

      const res = await fetch('/api/v1/cowork/research/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, message }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Research stream error (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;

          try {
            const parsed = JSON.parse(raw) as { event?: string; data?: unknown };
            const evType = parsed.event ?? '';

            if (evType === 'messages/partial' || evType === 'values') {
              const data = parsed.data as Array<{ type?: string; content?: string | Array<{ text?: string }> }> | undefined;
              if (Array.isArray(data)) {
                for (const msg of data) {
                  if (msg.type === 'ai' || msg.type === 'assistant') {
                    const text = typeof msg.content === 'string'
                      ? msg.content
                      : Array.isArray(msg.content)
                        ? msg.content.map((c) => c.text ?? '').join('')
                        : '';
                    if (text) {
                      accumulated = text;
                      setState((s) => ({ ...s, streamBuffer: text }));
                    }
                  }
                }
              }
            }
          } catch {
            // skip malformed frame
          }
        }
      }

      setState((s) => ({
        ...s,
        isStreaming: false,
        streamBuffer: '',
        messages: [
          ...s.messages,
          { role: 'assistant', content: accumulated || '(No response)' },
        ],
      }));
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setState((s) => ({
        ...s,
        isStreaming: false,
        streamBuffer: '',
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [state.isStreaming, ensureThread]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ threadId: null, messages: [], isStreaming: false, streamBuffer: '', error: null, isHealthy: null });
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/cowork/research/health');
      const data = await res.json() as { healthy?: boolean };
      setState((s) => ({ ...s, isHealthy: data.healthy ?? res.ok }));
    } catch {
      setState((s) => ({ ...s, isHealthy: false }));
    }
  }, []);

  return { ...state, query, reset, checkHealth };
}
