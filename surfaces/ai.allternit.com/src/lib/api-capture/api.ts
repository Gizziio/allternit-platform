/**
 * HAR-derived API capture client.
 *
 * Mirrors the backend `/api/har-derived-api/*` routes and exposes
 * ingest + client generation for the Site APIs surface.
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

export async function ingestHar(harJson: string): Promise<IngestResponse> {
  return api.post<IngestResponse>('/api/har-derived-api/ingest', { har: harJson });
}

export async function generateClient(
  endpointIds: string[],
  language: 'python' | 'typescript' | 'curl',
): Promise<GeneratedClient> {
  return api.post<GeneratedClient>('/api/har-derived-api/client', { endpoints: endpointIds, language });
}

// Placeholder: sessions/contracts are local-only until a persistent backend store exists.
// We persist derived contracts in localStorage so they survive reloads.
const CONTRACTS_KEY = 'allternit:har-derived-contracts';
const API_SKILLS_KEY = 'allternit:api-captured-skills';

export function loadPersistedContracts(): SiteApiContract[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CONTRACTS_KEY);
    return raw ? (JSON.parse(raw) as SiteApiContract[]) : [];
  } catch {
    return [];
  }
}

export function persistContracts(contracts: SiteApiContract[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONTRACTS_KEY, JSON.stringify(contracts));
  } catch {
    // ignore quota errors
  }
}

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
    description: description || `Reusable API workflow captured from ${contract.domain} with ${contract.endpoints.length} endpoint${contract.endpoints.length === 1 ? '' : 's'}.`,
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
  endpoints: Endpoint[],
  source: CaptureSession['source'] = 'upload',
): SiteApiContract {
  const hosts = Array.from(new Set(endpoints.map((e) => e.host))).filter(Boolean);
  const domain = hosts[0] || 'unknown';
  return {
    id: `${domain}-${Date.now()}`,
    domain,
    derived_at: new Date().toISOString(),
    endpoints,
  };
}

export async function replayEndpoint(
  endpoint: Endpoint,
  input: ReplayInput,
): Promise<ReplayResult> {
  // Build URL from path_template so user-supplied path params are substituted safely.
  let path = endpoint.path_template || endpoint.path;
  path = path.replace(/\{(\w+)\}/g, (_match, key) => {
    const value = input.path_params[key];
    return value === undefined || value === '' ? _match : encodeURIComponent(value);
  });

  let url: string;
  try {
    const parsed = new URL(endpoint.url);
    url = `${parsed.protocol}//${parsed.host}${path}`;
  } catch {
    url = `${endpoint.host}${path}`;
  }

  if (Object.keys(input.query_params).length > 0) {
    const parsed = new URL(url);
    for (const [key, value] of Object.entries(input.query_params)) {
      parsed.searchParams.set(key, String(value));
    }
    url = parsed.toString();
  }

  const headers: Record<string, string> = {};
  const contentType = endpoint.body_mime_type || 'application/json';
  if (contentType !== 'multipart/form-data') {
    headers['Content-Type'] = contentType;
  }
  for (const h of endpoint.headers) {
    if (!h.templated && h.name.toLowerCase() !== 'content-type') {
      headers[h.name] = h.value;
    }
  }
  for (const h of input.headers) {
    headers[h.name] = h.value;
  }

  let body: string | undefined;
  if (input.body) {
    body = JSON.stringify(input.body);
  } else if (endpoint.body_template) {
    body = endpoint.body_template;
  }

  try {
    const response = await fetch(url, {
      method: endpoint.method,
      headers,
      body,
    });
    const text = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: response.status, body: json };
  } catch (error) {
    return {
      status: 0,
      error: error instanceof Error ? error.message : 'Replay request failed',
    };
  }
}
