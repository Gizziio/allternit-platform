/**
 * Client for the design agent adapter API.
 *
 * Lets the Design mode detect which external agent runtimes (Claude Desktop,
 * Codex CLI, Allternit local, generic MCP) are available and request spawn
 * metadata for them.
 */

export interface AdapterKind {
  id: string;
  name: string;
  description: string;
  runtime: string;
  required_env: string[];
  optional_env: string[];
}

export interface AdapterDetectionResult {
  available: string[];
  missing: string[];
  env: Record<string, string>;
}

export interface SpawnAdapterRequest {
  kind: string;
  cwd?: string;
  env?: Record<string, string>;
}

export interface SpawnAdapterResponse {
  kind: string;
  status: string;
  command?: string;
  pid?: number;
}

export async function listAdapters(): Promise<{ adapters: AdapterKind[]; total: number }> {
  const res = await fetch('/api/design/adapters');
  if (!res.ok) return { adapters: [], total: 0 };
  return res.json();
}

export async function detectAdapters(cwd?: string): Promise<AdapterDetectionResult> {
  const res = await fetch('/api/design/adapters/detect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cwd }),
  });
  if (!res.ok) return { available: [], missing: [], env: {} };
  return res.json();
}

export async function spawnAdapter(req: SpawnAdapterRequest): Promise<SpawnAdapterResponse> {
  const res = await fetch('/api/design/adapters/spawn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) return { kind: req.kind, status: 'error' };
  return res.json();
}
