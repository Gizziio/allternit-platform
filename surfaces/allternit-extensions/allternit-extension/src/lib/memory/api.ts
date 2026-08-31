/**
 * Cross-session memory recall client for the extension.
 *
 * Fetches browser history and procedural memories that are relevant to the
 * current task/page so the agent can start with useful context.
 */

const GATEWAY_URL = 'http://127.0.0.1:8013';

export interface MemoryRecallResult {
  facts: string[];
  observations: string[];
  proceduralMemories: ProceduralMemory[];
  history: BrowserHistoryItem[];
}

export interface ProceduralMemory {
  id: string;
  name: string;
  description?: string | null;
  trigger_patterns: string[];
  steps: unknown[];
  success_count: number;
}

export interface BrowserHistoryItem {
  url: string;
  title?: string | null;
  domain: string;
  visit_time: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const result = await chrome.storage.local.get('AllternitClerkJwt');
  const token = result.AllternitClerkJwt;
  if (!token) {
    throw new Error('Not authenticated with Allternit');
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function matchProceduralMemory(context: string): Promise<ProceduralMemory[]> {
  const url = new URL(`${GATEWAY_URL}/api/v1/memory/procedural/match`);
  url.searchParams.set('context', context);
  url.searchParams.set('limit', '3');
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Procedural memory match failed: ${response.status} ${text}`);
  }
  const data = (await response.json()) as { memories: ProceduralMemory[] };
  return data.memories || [];
}

export async function listRecentBrowserHistory(domain?: string, limit = 10): Promise<BrowserHistoryItem[]> {
  const url = new URL(`${GATEWAY_URL}/api/v1/memory/browser-history`);
  if (domain) url.searchParams.set('domain', domain);
  url.searchParams.set('since_hours', '48');
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Browser history list failed: ${response.status} ${text}`);
  }
  const data = (await response.json()) as { items: BrowserHistoryItem[] };
  return data.items || [];
}

function formatHistoryItem(item: BrowserHistoryItem): string {
  const title = item.title ?? item.url;
  return `- ${title} (${item.domain})`;
}

function formatProceduralMemory(memory: ProceduralMemory): string {
  const steps = memory.steps
    .map((step, index) => {
      const s = step as Record<string, unknown> | undefined;
      const action = s?.action ?? 'step';
      const url = s?.url ?? '';
      return `  ${index + 1}. ${action}${url ? ` ${url}` : ''}`;
    })
    .join('\n');
  return `Reusable workflow "${memory.name}" (used ${memory.success_count} times):\n${steps}`;
}

export interface MemoryNote {
  id: string;
  user_id: string;
  note_type: 'person' | 'website' | 'episodic' | 'general';
  title: string;
  content: string;
  tags: string[];
  entity_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMemoryNoteRequest {
  note_type: MemoryNote['note_type'];
  title: string;
  content: string;
  tags?: string[];
  entity_id?: string;
}

export async function listMemoryNotes(
  noteType?: MemoryNote['note_type'],
  search?: string,
): Promise<MemoryNote[]> {
  const url = new URL(`${GATEWAY_URL}/api/v1/memory/notes`);
  if (noteType) url.searchParams.set('note_type', noteType);
  if (search) url.searchParams.set('search', search);
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Memory notes list failed: ${response.status} ${text}`);
  }
  const data = (await response.json()) as { notes: MemoryNote[] };
  return data.notes || [];
}

export async function createMemoryNote(note: CreateMemoryNoteRequest): Promise<{ id: string }> {
  const response = await fetch(`${GATEWAY_URL}/api/v1/memory/notes`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(note),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Memory note create failed: ${response.status} ${text}`);
  }
  return (await response.json()) as { id: string };
}

export async function updateMemoryNote(
  id: string,
  note: Partial<Pick<MemoryNote, 'title' | 'content' | 'tags'>>,
): Promise<void> {
  const response = await fetch(`${GATEWAY_URL}/api/v1/memory/notes/${id}`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(note),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Memory note update failed: ${response.status} ${text}`);
  }
}

export async function deleteMemoryNote(id: string): Promise<void> {
  const response = await fetch(`${GATEWAY_URL}/api/v1/memory/notes/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Memory note delete failed: ${response.status} ${text}`);
  }
}

export async function recallMemoryContext(context: string, domain?: string): Promise<string> {
  try {
    const [memories, history] = await Promise.all([
      matchProceduralMemory(context),
      listRecentBrowserHistory(domain, 5),
    ]);

    const parts: string[] = [];

    if (memories.length > 0) {
      parts.push('## Reusable workflows from past successful tasks\n');
      parts.push(memories.map(formatProceduralMemory).join('\n\n'));
    }

    if (history.length > 0) {
      parts.push('## Recent browsing context\n');
      parts.push(history.map(formatHistoryItem).join('\n'));
    }

    if (parts.length === 0) {
      return '';
    }

    return `\n\n<!-- Cross-session memory context -->\n${parts.join('\n\n')}\n\n<!-- End memory context -->\n\n`;
  } catch (error) {
    // Memory recall is best-effort; don't block the task on failure.
    console.debug('[Allternit Memory] Recall failed:', error);
    return '';
  }
}
