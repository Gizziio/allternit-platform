const mcpUrl = () =>
  process.env.COWORK_MEMORY_MCP_URL ?? "http://localhost:8761";

const mcpKey = () =>
  process.env.COWORK_MEMORY_MCP_API_KEY ?? "";

const apiUrl = () =>
  process.env.COWORK_MEMORY_API_URL ?? "http://localhost:8765";

const apiKey = () =>
  process.env.COWORK_MEMORY_API_KEY ?? "";

const userId = () =>
  process.env.COWORK_MEMORY_USER_ID ?? "allternit";

function mcpHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${mcpKey()}`,
  };
}

function apiHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey()}`,
  };
}

export interface CoworkMemoryEntry {
  id: string;
  content: string;
  tags?: string[];
  memory_type?: string;
  created_at?: string;
  score?: number;
}

export interface CoworkMemorySearchResult {
  results: CoworkMemoryEntry[];
  total: number;
}

export async function storeMemory(params: {
  content: string;
  tags?: string[];
  memory_type?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string }> {
  const res = await fetch(`${mcpUrl()}/api/store`, {
    method: "POST",
    headers: mcpHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Memory store failed (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<{ id: string }>;
}

export async function searchMemory(params: {
  query: string;
  limit?: number;
  tags?: string[];
}): Promise<CoworkMemorySearchResult> {
  const res = await fetch(`${mcpUrl()}/api/search`, {
    method: "POST",
    headers: mcpHeaders(),
    body: JSON.stringify({ ...params, limit: params.limit ?? 10 }),
  });
  if (!res.ok) {
    throw new Error(`Memory search failed (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<CoworkMemorySearchResult>;
}

export async function deleteMemory(id: string): Promise<void> {
  const res = await fetch(`${mcpUrl()}/api/delete/${id}`, {
    method: "DELETE",
    headers: mcpHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Memory delete failed (${res.status}): ${await res.text()}`);
  }
}

export async function addAgentMemory(params: {
  messages: Array<{ role: string; content: string }>;
  agent_id?: string;
  metadata?: Record<string, unknown>;
}): Promise<unknown> {
  const res = await fetch(`${apiUrl()}/v1/memories/`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      ...params,
      user_id: userId(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Agent memory add failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function searchAgentMemory(params: {
  query: string;
  agent_id?: string;
  limit?: number;
}): Promise<unknown> {
  const res = await fetch(`${apiUrl()}/v1/memories/search/`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      ...params,
      user_id: userId(),
      limit: params.limit ?? 10,
    }),
  });
  if (!res.ok) {
    throw new Error(`Agent memory search failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function checkMemoryHealth(): Promise<{
  mcp: boolean;
  api: boolean;
}> {
  const [mcpRes, apiRes] = await Promise.allSettled([
    fetch(`${mcpUrl()}/api/health`, { headers: mcpHeaders() }),
    fetch(`${apiUrl()}/healthz`, { headers: apiHeaders() }),
  ]);
  return {
    mcp: mcpRes.status === "fulfilled" && mcpRes.value.ok,
    api: apiRes.status === "fulfilled" && apiRes.value.ok,
  };
}
