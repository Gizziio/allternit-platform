const RESEARCH_BASE = process.env.COWORK_RESEARCH_URL ?? 'http://localhost:8764';

export interface ResearchMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ResearchRunOptions {
  threadId: string;
  message: string;
  modelName?: string;
  thinkingEnabled?: boolean;
}

export interface ResearchStreamEvent {
  type: 'message' | 'tool_call' | 'tool_result' | 'end' | 'error';
  data: unknown;
}

export async function createResearchThread(): Promise<string> {
  const res = await fetch(`${RESEARCH_BASE}/api/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Research: failed to create thread (${res.status})`);
  const json = await res.json();
  return json.thread_id as string;
}

export async function* streamResearchRun(opts: ResearchRunOptions): AsyncGenerator<ResearchStreamEvent> {
  const { threadId, message, modelName, thinkingEnabled } = opts;

  const body: Record<string, unknown> = {
    input: { messages: [{ role: 'user', content: message }] },
    config: {
      configurable: {
        ...(modelName ? { model_name: modelName } : {}),
        ...(thinkingEnabled !== undefined ? { thinking_enabled: thinkingEnabled } : {}),
      },
    },
    stream_mode: ['messages', 'values', 'custom'],
  };

  const res = await fetch(`${RESEARCH_BASE}/api/threads/${threadId}/runs/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Research: stream failed (${res.status})`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Research: no response body');

  const decoder = new TextDecoder();
  let buffer = '';

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
        const event = parsed.event ?? 'message';

        if (event === 'messages/partial') {
          yield { type: 'message', data: parsed.data };
        } else if (event === 'values') {
          yield { type: 'message', data: parsed.data };
        } else if (event === 'end') {
          yield { type: 'end', data: parsed.data };
        }
      } catch {
        // skip malformed SSE frames
      }
    }
  }

  yield { type: 'end', data: null };
}

export async function getResearchThreadMessages(threadId: string): Promise<ResearchMessage[]> {
  const res = await fetch(`${RESEARCH_BASE}/api/threads/${threadId}/messages`);
  if (!res.ok) throw new Error(`Research: failed to get messages (${res.status})`);
  const json = await res.json();
  const raw = Array.isArray(json) ? json : (json.data ?? []);
  return raw.map((m: { type?: string; role?: string; content?: unknown }) => ({
    role: (m.type === 'human' ? 'user' : m.type === 'tool' ? 'tool' : 'assistant') as ResearchMessage['role'],
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
  }));
}

export async function deleteResearchThread(threadId: string): Promise<void> {
  await fetch(`${RESEARCH_BASE}/api/threads/${threadId}`, { method: 'DELETE' });
}

export async function checkResearchHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${RESEARCH_BASE}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}
