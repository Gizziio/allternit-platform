/**
 * Open Notebook API Client
 * Thin wrapper around the headless Open Notebook backend on port 5055.
 */

const ON_BASE = process.env.NEXT_PUBLIC_OPEN_NOTEBOOK_URL || 'http://127.0.0.1:5055';

export interface Notebook {
  id: string;
  title: string;
  description?: string;
  source_count: number;
  token_count: number;
  owner_id?: string;
  shared_with?: string[];
  created_at: string;
  updated_at: string;
}

export interface Source {
  id: string;
  notebook_id: string;
  type: 'upload' | 'url' | 'gmail' | 'slack' | 'notion' | 'text';
  title: string;
  url?: string;
  content?: string;
  token_count: number;
  status: 'pending' | 'extracted' | 'failed';
  metadata?: Record<string, any>;
}

export interface Citation {
  index: number;
  source_id: string;
  excerpt: string;
  page_number?: number;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp?: string;
  created_at?: string;
}

export interface SearchResult {
  source_id: string;
  excerpt: string;
  score: number;
  page_number?: number;
}

async function onFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${ON_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Open Notebook API error (${res.status}): ${err}`);
  }
  return res.json() as Promise<T>;
}

export const notebookApi = {
  // Health
  health: () => onFetch<{ status: string }>('/health'),

  // Notebooks
  listNotebooks: (ownerId?: string) =>
    onFetch<Notebook[]>(`/api/notebooks${ownerId ? `?owner_id=${encodeURIComponent(ownerId)}` : ''}`),
  createNotebook: (title: string, description?: string, ownerId?: string) =>
    onFetch<Notebook>('/api/notebooks', {
      method: 'POST',
      body: JSON.stringify({ title, description, owner_id: ownerId }),
    }),
  deleteNotebook: (id: string) =>
    onFetch<void>(`/api/notebooks/${id}`, { method: 'DELETE' }),

  // Sharing
  shareNotebook: (notebookId: string, userId: string) =>
    onFetch<{ success: boolean; shared_with: string[] }>(`/api/notebooks/${notebookId}/share`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
  unshareNotebook: (notebookId: string, userId: string) =>
    onFetch<{ success: boolean; shared_with: string[] }>(`/api/notebooks/${notebookId}/unshare`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),

  // Sources
  listSources: (notebookId: string) =>
    onFetch<Source[]>(`/api/notebooks/${notebookId}/sources`),
  addSource: (notebookId: string, source: Partial<Source>) =>
    onFetch<Source>(`/api/notebooks/${notebookId}/sources`, {
      method: 'POST',
      body: JSON.stringify(source),
    }),
  removeSource: (notebookId: string, sourceId: string) =>
    onFetch<void>(`/api/notebooks/${notebookId}/sources/${sourceId}`, { method: 'DELETE' }),

  // Messages
  listMessages: (notebookId: string) =>
    onFetch<ChatMessage[]>(`/api/notebooks/${notebookId}/chat/messages`),

  // Chat
  sendMessage: async (
    notebookId: string,
    message: string,
    onChunk: (chunk: { text?: string; citation?: Citation; done?: boolean }) => void
  ) => {
    const res = await fetch(`${ON_BASE}/api/notebooks/${notebookId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!res.ok || !res.body) throw new Error('Chat request failed');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
          try {
            const data = JSON.parse(line.trim().slice(6));
            onChunk(data);
          } catch {
            // ignore parse errors
          }
        }
      }
    }
    onChunk({ done: true });
  },

  // Search
  search: (notebookId: string, query: string, limit = 10) =>
    onFetch<{ results: SearchResult[] }>(`/api/notebooks/${notebookId}/search`, {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    }),

  // Canvas Sync
  canvasSync: (notebookId: string, canvasCourseId: string, canvasToken: string, canvasDomain?: string) =>
    onFetch<{
      success: boolean;
      course: { id: number; name: string; course_code: string };
      sources_created: number;
      sources: Array<{ id: string; title: string; type: string }>;
    }>(`/api/notebooks/${notebookId}/canvas-sync`, {
      method: 'POST',
      body: JSON.stringify({
        canvas_course_id: canvasCourseId,
        canvas_token: canvasToken,
        canvas_domain: canvasDomain || 'https://canvas.instructure.com',
      }),
    }),

  // Transformations
  transform: (notebookId: string, type: 'summary' | 'briefing' | 'faq' | 'timeline') =>
    onFetch<{ content: string }>(`/api/notebooks/${notebookId}/transform`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    }),

  // Podcast
  generatePodcast: (notebookId: string, config?: { speakers?: number; style?: string }) =>
    onFetch<{ audio_url: string; duration: number }>(`/api/notebooks/${notebookId}/podcast`, {
      method: 'POST',
      body: JSON.stringify(config || {}),
    }),
};
