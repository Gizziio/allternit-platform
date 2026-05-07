export type ArtifactType =
  | 'document'
  | 'spec'
  | 'research'
  | 'analysis'
  | 'plan'
  | 'design'
  | 'proposal'
  | 'review'
  | 'decision'
  | 'report'
  | 'experiment'
  | 'feature'
  | 'guide'
  | 'log';

export type ArtifactStatus = 'draft' | 'active' | 'final' | 'archived';

export interface ArtifactSectionDto {
  id: string;
  artifactId: string;
  heading: string;
  kind: string;
  body: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactRevisionDto {
  id: string;
  artifactId: string;
  createdAt: string;
  reason: string;
  snapshot: {
    title: string;
    type: ArtifactType;
    status: ArtifactStatus;
    summary?: string;
    tags: string[];
    sections: ArtifactSectionDto[];
    updatedAt: string;
  };
}

export interface ArtifactDto {
  id: string;
  workspaceId: string;
  title: string;
  type: ArtifactType;
  status: ArtifactStatus;
  summary?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  sections: ArtifactSectionDto[];
  revisions: ArtifactRevisionDto[];
}

export interface ArtifactWorkspaceStatsDto {
  workspaceId: string;
  total: number;
  drafts: number;
  final: number;
  updatedAt: string;
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${fallbackMessage} (${response.status})`);
  }
  return (await response.json()) as T;
}

export async function fetchArtifacts(filters: {
  workspaceId?: string;
  status?: ArtifactStatus;
  type?: ArtifactType;
  q?: string;
} = {}): Promise<ArtifactDto[]> {
  const searchParams = new URLSearchParams();
  if (filters.workspaceId) searchParams.set('workspaceId', filters.workspaceId);
  if (filters.status) searchParams.set('status', filters.status);
  if (filters.type) searchParams.set('type', filters.type);
  if (filters.q) searchParams.set('q', filters.q);
  const query = searchParams.toString();
  const response = await fetch(`/api/v1/artifacts${query ? `?${query}` : ''}`);
  const payload = await readJson<{ artifacts?: ArtifactDto[] }>(response, 'Failed to load artifacts');
  return Array.isArray(payload.artifacts) ? payload.artifacts : [];
}

export async function createArtifact(input: {
  workspaceId: string;
  title: string;
  type?: ArtifactType;
  status?: ArtifactStatus;
  summary?: string;
  tags?: string[];
  sections?: Array<{ heading?: string; kind?: string; body?: string; position?: number }>;
}): Promise<ArtifactDto> {
  const response = await fetch('/api/v1/artifacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await readJson<{ artifact: ArtifactDto }>(response, 'Failed to create artifact');
  return payload.artifact;
}

export async function fetchArtifactById(id: string): Promise<ArtifactDto> {
  const response = await fetch(`/api/v1/artifacts/${encodeURIComponent(id)}`);
  const payload = await readJson<{ artifact: ArtifactDto }>(response, 'Failed to load artifact');
  return payload.artifact;
}

export async function updateArtifact(id: string, input: {
  title?: string;
  type?: ArtifactType;
  status?: ArtifactStatus;
  summary?: string | null;
  tags?: string[];
}): Promise<ArtifactDto> {
  const response = await fetch(`/api/v1/artifacts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await readJson<{ artifact: ArtifactDto }>(response, 'Failed to update artifact');
  return payload.artifact;
}

export async function createArtifactSection(
  artifactId: string,
  input: { heading: string; kind?: string; body?: string; position?: number }
): Promise<ArtifactSectionDto> {
  const response = await fetch(`/api/v1/artifacts/${encodeURIComponent(artifactId)}/sections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await readJson<{ section: ArtifactSectionDto }>(response, 'Failed to create artifact section');
  return payload.section;
}

export async function updateArtifactSection(
  artifactId: string,
  sectionId: string,
  input: { heading?: string; kind?: string; body?: string; position?: number }
): Promise<ArtifactSectionDto> {
  const response = await fetch(
    `/api/v1/artifacts/${encodeURIComponent(artifactId)}/sections/${encodeURIComponent(sectionId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  );
  const payload = await readJson<{ section: ArtifactSectionDto }>(response, 'Failed to update artifact section');
  return payload.section;
}

export async function fetchArtifactRevisions(artifactId: string): Promise<ArtifactRevisionDto[]> {
  const response = await fetch(`/api/v1/artifacts/${encodeURIComponent(artifactId)}/revisions`);
  const payload = await readJson<{ revisions?: ArtifactRevisionDto[] }>(response, 'Failed to load revisions');
  return Array.isArray(payload.revisions) ? payload.revisions : [];
}

export async function searchArtifacts(q: string, workspaceId?: string): Promise<ArtifactDto[]> {
  const searchParams = new URLSearchParams({ q });
  if (workspaceId) searchParams.set('workspaceId', workspaceId);
  const response = await fetch(`/api/v1/artifacts/search?${searchParams.toString()}`);
  const payload = await readJson<{ artifacts?: ArtifactDto[] }>(response, 'Failed to search artifacts');
  return Array.isArray(payload.artifacts) ? payload.artifacts : [];
}

export async function fetchArtifactStatsByWorkspace(): Promise<ArtifactWorkspaceStatsDto[]> {
  const response = await fetch('/api/v1/artifacts/stats');
  const payload = await readJson<{ stats?: ArtifactWorkspaceStatsDto[] }>(response, 'Failed to load artifact stats');
  return Array.isArray(payload.stats) ? payload.stats : [];
}
