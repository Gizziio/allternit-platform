import { apiRequestWithError, gizziBaseUrl } from '@/lib/agents/api-config';

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

export interface BrainProvisionResponse {
  brain_id: string;
  clone_url: string;
  created_at: string;
  sync: unknown;
}

export interface BrainImportResponse {
  clone_url: string;
  sync: unknown;
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

export async function createBrain(): Promise<BrainProvisionResponse> {
  // Provisioning goes through the local gizzi-code runtime so it can perform
  // local init → platform create → remote link → sync in one call. In the
  // desktop shell gizzi-code uses its own allternit-api auth; in the web UI
  // the caller's Clerk token is forwarded through apiRequestWithError.
  return apiRequestWithError<BrainProvisionResponse>(`${gizziBaseUrl()}/brain/provision`, {
    method: 'POST',
  });
}

export async function importBrain(cloneUrl: string): Promise<BrainImportResponse> {
  return apiRequestWithError<BrainImportResponse>(`${gizziBaseUrl()}/brain/import`, {
    method: 'POST',
    body: JSON.stringify({ clone_url: cloneUrl }),
  });
}
