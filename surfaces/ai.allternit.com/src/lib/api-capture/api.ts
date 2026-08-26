/**
 * HAR-derived API capture client.
 *
 * Mirrors the backend `/api/har-derived-api/*` routes and exposes
 * ingest, persistence, replay, and client generation for the Site APIs surface.
 */

import { api } from '@/integration/api-client';

export interface Endpoint {
  id: string;
  method: string;
  url: string;
  host: string;
  path: string;
  path_template: string;
  summary?: string;
  query_params: Param[];
  path_params: Param[];
  headers: Param[];
  body_template?: string;
  body_mime_type?: string;
  body_params: Param[];
  status_code: number;
  response_sample?: string;
  hit_count: number;
}

export interface Param {
  name: string;
  value: string;
  templated: boolean;
  suggested_default?: string;
}

export interface SiteApiContract {
  id: string;
  domain: string;
  source: CaptureSession['source'];
  derived_at: string;
  endpoints: Endpoint[];
}

export interface CaptureSession {
  id: string;
  domain: string;
  source: 'browser' | 'aci' | 'upload';
  status: 'capturing' | 'completed' | 'failed';
  started_at: string;
  ended_at?: string;
}

export interface ReplayInput {
  path_params: Record<string, string>;
  query_params: Record<string, string>;
  headers: Array<{ name: string; value: string }>;
  body: unknown;
}

export interface ReplayResult {
  status: number;
  body?: unknown;
  error?: string;
}

export interface IngestResponse {
  contract_id: string;
  domain: string;
  endpoints: Endpoint[];
  stats: {
    total_entries: number;
    api_entries: number;
    hosts: string[];
  };
}

export interface GeneratedClient {
  language: string;
  code: string;
  notes: string[];
}

export interface ApiSkillEndpointRef {
  id: string;
  method: string;
  path_template: string;
  summary?: string;
}

export interface ApiSkill {
  id: string;
  name: string;
  description: string;
  domain: string;
  mode: 'API';
  origin: 'api-capture';
  contractId: string;
  endpoints: ApiSkillEndpointRef[];
  createdAt: string;
  status: 'active' | 'inactive';
}

export async function ingestHar(
  harJson: string,
  source: CaptureSession['source'] = 'upload',
): Promise<IngestResponse> {
  return api.post<IngestResponse>('/api/har-derived-api/ingest', { har: harJson, source });
}

export async function listContracts(): Promise<SiteApiContract[]> {
  const res = await api.get<{ contracts: SiteApiContract[] }>('/api/har-derived-api/contracts');
  return res.contracts ?? [];
}

export async function getContract(contractId: string): Promise<SiteApiContract | null> {
  try {
    return await api.get<SiteApiContract>(`/api/har-derived-api/contracts/${contractId}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

export async function deleteContract(contractId: string): Promise<void> {
  await api.delete(`/api/har-derived-api/contracts/${contractId}`);
}

export async function generateClient(
  endpointIds: string[],
  language: 'python' | 'typescript' | 'curl',
): Promise<GeneratedClient> {
  return api.post<GeneratedClient>('/api/har-derived-api/client', { endpoints: endpointIds, language });
}

export async function replayEndpoint(
  contractId: string,
  endpointId: string,
  input: ReplayInput,
): Promise<ReplayResult> {
  return api.post<ReplayResult>(
    `/api/har-derived-api/contracts/${contractId}/replay/${endpointId}`,
    input,
  );
}

// API-captured skills are still local-only until a skill registry backend
// surface exists for this origin type.
const API_SKILLS_KEY = 'allternit:api-captured-skills';

export function loadPersistedApiSkills(): ApiSkill[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(API_SKILLS_KEY);
    return raw ? (JSON.parse(raw) as ApiSkill[]) : [];
  } catch {
    return [];
  }
}

export function persistApiSkills(skills: ApiSkill[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(API_SKILLS_KEY, JSON.stringify(skills));
  } catch {
    // ignore quota errors
  }
}

export function notifyApiSkillsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('allternit:api-skills-changed'));
}

export function createApiSkillFromContract(
  contract: SiteApiContract,
  name: string,
  description: string,
): ApiSkill {
  return {
    id: `api-skill-${contract.domain}-${Date.now()}`,
    name: name || `${contract.domain} API skill`,
    description:
      description ||
      `Reusable API workflow captured from ${contract.domain} with ${contract.endpoints.length} endpoint${contract.endpoints.length === 1 ? '' : 's'}.`,
    domain: contract.domain,
    mode: 'API',
    origin: 'api-capture',
    contractId: contract.id,
    endpoints: contract.endpoints.map((e) => ({
      id: e.id,
      method: e.method,
      path_template: e.path_template || e.path,
      summary: e.summary,
    })),
    createdAt: new Date().toISOString(),
    status: 'active',
  };
}

export function createContractFromHar(
  response: IngestResponse,
  source: CaptureSession['source'] = 'upload',
): SiteApiContract {
  return {
    id: response.contract_id,
    domain: response.domain,
    source,
    derived_at: new Date().toISOString(),
    endpoints: response.endpoints,
  };
}
