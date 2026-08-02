export interface BrainSummary {
  brain_id: string;
  created_at: string;
  clone_url: string;
}

export type BrainFrontmatterValue = string | string[];

export interface BrainPage {
  path: string;
  frontmatter: Record<string, BrainFrontmatterValue>;
  content: string;
}

export interface BrainPagesResponse {
  brain_id: string;
  branch: string | null;
  pages: BrainPage[];
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${fallbackMessage} (${response.status})`);
  }
  return (await response.json()) as T;
}

export async function fetchBrains(signal?: AbortSignal): Promise<BrainSummary[]> {
  const response = await fetch('/api/v1/brains', { signal });
  const payload = await readJson<unknown>(response, 'Failed to load brains');
  return Array.isArray(payload) ? (payload as BrainSummary[]) : [];
}

export async function fetchBrainPages(brainId: string, signal?: AbortSignal): Promise<BrainPagesResponse> {
  const response = await fetch(`/api/v1/brains/${encodeURIComponent(brainId)}/pages`, { signal });
  const payload = await readJson<Partial<BrainPagesResponse>>(response, 'Failed to load brain pages');
  return {
    brain_id: payload.brain_id ?? brainId,
    branch: payload.branch ?? null,
    pages: Array.isArray(payload.pages) ? (payload.pages as BrainPage[]) : [],
  };
}
