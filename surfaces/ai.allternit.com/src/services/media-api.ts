const base = () => '/api/v1';

export interface MediaProvider {
  id: string;
  name: string;
  modes: Array<'image' | 'video' | 'website' | 'slides' | 'sheets' | 'doc'>;
  authType: 'none' | 'api_key' | 'subprocess' | 'mcp';
  authProviderID?: string;
  description?: string;
  tier?: 'free' | 'cheap' | 'standard' | 'premium';
  available?: boolean;
}

export interface MediaArtifact {
  id: string;
  url?: string;
  data?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

export interface MediaGenerateResult {
  artifacts: MediaArtifact[];
  prompt: string;
  config?: Record<string, unknown>;
}

export interface MediaGenerateInput {
  providerID: string;
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:2' | '2:3';
  duration?: number;
  fps?: number;
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  style?: string;
  negativePrompt?: string;
  seed?: number;
  content?: Record<string, unknown>;
  n?: number;
}

export async function fetchMediaProviders(): Promise<MediaProvider[]> {
  const response = await fetch(`${base()}/media/providers`, { credentials: 'include' });
  if (!response.ok) throw new Error(`Failed to load media providers (${response.status})`);
  return (await response.json()) as MediaProvider[];
}

export async function fetchMediaProvidersForMode(mode: string): Promise<MediaProvider[]> {
  const response = await fetch(`${base()}/media/${encodeURIComponent(mode)}/providers`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Failed to load media providers (${response.status})`);
  return (await response.json()) as MediaProvider[];
}

export async function generateMedia(mode: string, input: MediaGenerateInput): Promise<MediaGenerateResult> {
  const response = await fetch(`${base()}/media/${encodeURIComponent(mode)}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as MediaGenerateResult & { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(payload.message || `Media generation failed (${response.status})`);
  }
  return payload;
}
