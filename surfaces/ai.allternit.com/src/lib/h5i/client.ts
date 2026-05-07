/**
 * h5i Frontend Client
 *
 * Browser-side utilities for calling h5i API routes.
 */

export interface H5iVibeResponse {
  success: boolean;
  result?: {
    aiRatio: number;
    aiDirectories: string[];
    riskiestFiles: string[];
    leakedTokens: string[];
    promptInjectionHits: string[];
  };
  raw?: string;
  error?: string;
}

export interface H5iStatusResponse {
  initialized: boolean;
  version?: string;
  contextExists: boolean;
  notesCount: number;
  sessionCount: number;
}

export async function fetchH5iVibe(workspacePath: string): Promise<H5iVibeResponse> {
  const res = await fetch('/api/h5i/vibe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspacePath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `h5i vibe failed: ${res.status}`);
  }
  return res.json();
}

export async function initH5i(workspacePath: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/h5i/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspacePath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `h5i init failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchH5iStatus(workspacePath: string): Promise<H5iStatusResponse> {
  const res = await fetch('/api/h5i/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspacePath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `h5i status failed: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface H5iContextEntry {
  timestamp: string;
  type: 'OBSERVE' | 'THINK' | 'ACT' | 'NOTE';
  content: string;
}

export async function startH5iContext(
  workspacePath: string,
  sessionId: string,
  goal: string,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/h5i/context/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspacePath, sessionId, goal }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `h5i context start failed: ${res.status}`);
  }
  return res.json();
}

export async function finishH5iContext(
  workspacePath: string,
  sessionId: string,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/h5i/context/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspacePath, sessionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `h5i context finish failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchH5iContextTrace(
  workspacePath: string,
  sessionId: string,
): Promise<{ success: boolean; trace?: H5iContextEntry[]; error?: string }> {
  const res = await fetch('/api/h5i/context/trace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspacePath, sessionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `h5i context trace failed: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Claims & Summaries
// ---------------------------------------------------------------------------

export interface H5iClaim {
  id: string;
  text: string;
  paths: string[];
  status: 'live' | 'stale';
}

export interface H5iSummary {
  path: string;
  text: string;
  blobOid: string;
  valid: boolean;
}

export async function fetchH5iClaims(workspacePath: string): Promise<{ success: boolean; claims?: H5iClaim[]; error?: string }> {
  const res = await fetch('/api/h5i/claims/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspacePath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `h5i claims list failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchH5iSummaries(workspacePath: string): Promise<{ success: boolean; summaries?: H5iSummary[]; error?: string }> {
  const res = await fetch('/api/h5i/summary/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspacePath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `h5i summary list failed: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Tier 3: Diff + Commit
// ---------------------------------------------------------------------------

export interface H5iDiffEntry {
  type: 'OBSERVE' | 'THINK' | 'ACT' | 'NOTE';
  side: 'A' | 'B' | 'both';
  content: string;
}

export async function diffH5iContext(
  workspacePath: string,
  sessionA: string,
  sessionB: string,
): Promise<{ success: boolean; diff?: H5iDiffEntry[]; error?: string }> {
  const res = await fetch('/api/h5i/context/diff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspacePath, sessionA, sessionB }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `h5i context diff failed: ${res.status}`);
  }
  return res.json();
}

export async function commitWithH5i(
  workspacePath: string,
  message: string,
  options: { model?: string; agent?: string; prompt?: string; files?: string[] },
): Promise<{ success: boolean; hash?: string; error?: string }> {
  const res = await fetch('/api/h5i/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspacePath, message, ...options }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `h5i commit failed: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Agent Hooks
// ---------------------------------------------------------------------------

export async function installAgentHooks(
  workspacePath: string,
  agents?: string[],
): Promise<{ success: boolean; installed: string[]; errors: string[] }> {
  const res = await fetch('/api/h5i/agent-hooks/install', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspacePath, agents }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Install failed: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Auto-summarization
// ---------------------------------------------------------------------------

export async function generateSessionSummary(
  workspacePath: string,
  sessionId: string,
): Promise<{ success: boolean; summary?: string; error?: string }> {
  const res = await fetch('/api/h5i/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspacePath, sessionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Summarization failed: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

export interface McpConfigResponse {
  mcpAvailable: boolean;
  config: { name: string; command: string; args: string[] };
  claudeSettings: { mcpServers: { h5i: { command: string; args: string[] } } };
}

export async function fetchMcpConfig(): Promise<McpConfigResponse> {
  const res = await fetch('/api/h5i/mcp/config');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `MCP config failed: ${res.status}`);
  }
  return res.json();
}
