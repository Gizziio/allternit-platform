/**
 * Memory Agent API Client
 *
 * Direct platform interface to the Memory Agent RAG service (port 3201).
 * Used for persistent memory queries and content ingestion from the UI.
 */

const getMemoryUrl = () =>
  (typeof window !== 'undefined' && (window as any).__ALLTERNIT_MEMORY_URL__) ||
  process.env.NEXT_PUBLIC_ALLTERNIT_MEMORY_URL ||
  'http://localhost:3201';

export async function queryMemory(params: { query: string }): Promise<unknown> {
  const res = await fetch(`${getMemoryUrl()}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Memory query failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function ingestContent(params: {
  content: string;
  type?: string;
  tags?: string[];
}): Promise<unknown> {
  const res = await fetch(`${getMemoryUrl()}/api/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Memory ingest failed (${res.status}): ${text}`);
  }
  return res.json();
}
