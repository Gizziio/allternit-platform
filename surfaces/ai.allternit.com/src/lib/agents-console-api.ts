/**
 * Cloud Agents Console — Hub client for POST /api/v1/sessions.
 * Uses the existing gateway client. Not an OpenAI/Anthropic SDK.
 */

import { api } from "@/integration/api-client";

export type ComputerKind = "none" | "sandbox" | "desktop" | "fabric" | "local";

export interface ConsoleSession {
  id: string;
  agent_id?: string;
  status?: string;
  updated_at?: string;
  created_at?: string;
  computer?: { kind?: string; id?: string | null };
  budget?: {
    estimated_cost_usd?: number;
    estimated_cost_cents?: number;
    charged?: boolean;
    max_cost_usd?: number | null;
  };
}

export interface CreateConsoleSessionInput {
  model: string;
  instructions: string;
  input: string;
  computerKind: ComputerKind;
  maxCostUsd?: number;
}

export type CreateConsoleResult =
  | { ok: true; session: ConsoleSession }
  | { ok: false; unavailable: true; error: string; code: string }
  | { ok: false; unavailable: false; error: string; status: number };

export function buildSessionBody(input: CreateConsoleSessionInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    agent: {
      model: input.model.trim() || "kimi-k2",
      instructions: input.instructions.trim() || undefined,
    },
    computer: { kind: input.computerKind || "none" },
    input: input.input.trim() || undefined,
  };
  if (input.maxCostUsd != null && Number.isFinite(input.maxCostUsd)) {
    body.budget = { max_cost_usd: input.maxCostUsd };
  }
  return body;
}

export function sessionCreateCurl(
  baseUrl: string,
  body: Record<string, unknown>,
): string {
  const base = baseUrl.replace(/\/+$/, "") || "http://localhost:8013";
  return [
    `curl -X POST ${base}/api/v1/sessions \\`,
    `  -H "Authorization: Bearer $CLERK_JWT" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${JSON.stringify(body)}'`,
  ].join("\n");
}

export function sessionCreateSdk(body: Record<string, unknown>): string {
  return [
    `import { Allternit } from "@allternit/sdk/cloud-agents";`,
    `const allternit = new Allternit({ apiKey, baseURL });`,
    `const session = await allternit.sessions.create(${JSON.stringify(body, null, 2)});`,
  ].join("\n");
}

export async function createConsoleSession(
  input: CreateConsoleSessionInput,
): Promise<CreateConsoleResult> {
  const body = buildSessionBody(input);
  const response = await api.raw("/api/v1/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as {
    session?: ConsoleSession;
    error?: string;
    message?: string;
    code?: string;
  };
  if (response.status === 503 || json.code === "computer_unavailable") {
    return {
      ok: false,
      unavailable: true,
      error: json.error || json.message || "Computer Cloud has no VM driver on this host",
      code: json.code || "computer_unavailable",
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      unavailable: false,
      error: json.error || json.message || `HTTP ${response.status}`,
      status: response.status,
    };
  }
  if (!json.session?.id) {
    return { ok: false, unavailable: false, error: "Create returned no session", status: response.status };
  }
  return { ok: true, session: json.session };
}

export async function sendConsoleEvent(
  sessionId: string,
  type: "user.message" | "user.interrupt",
  content?: string,
): Promise<void> {
  await api.post(`/api/v1/sessions/${encodeURIComponent(sessionId)}/events`, {
    events: content
      ? [{ type, content }]
      : [{ type }],
  });
}

export async function archiveConsoleSession(sessionId: string): Promise<void> {
  await api.post(`/api/v1/sessions/${encodeURIComponent(sessionId)}/archive`, {});
}

export async function listConsoleSessions(): Promise<ConsoleSession[]> {
  const body = await api.get<{ sessions?: ConsoleSession[] }>("/api/v1/sessions");
  return Array.isArray(body.sessions) ? body.sessions : [];
}

export async function retrieveConsoleSession(sessionId: string): Promise<ConsoleSession> {
  const body = await api.get<{ session: ConsoleSession }>(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}`,
  );
  return body.session;
}

export function parseSseChunk(
  buffer: string,
  onEvent: (event: { type?: string; data?: unknown }) => void,
): string {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const block of parts) {
    const dataLines = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());
    if (dataLines.length === 0) continue;
    const raw = dataLines.join("\n");
    try {
      const parsed = JSON.parse(raw) as { type?: string; data?: unknown };
      onEvent(parsed);
    } catch {
      onEvent({ type: "raw", data: raw });
    }
  }
  return rest;
}

