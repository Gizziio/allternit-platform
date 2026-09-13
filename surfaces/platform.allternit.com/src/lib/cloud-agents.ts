import { AllternitApiError, api } from "@/lib/api-client";

export type ComputerKind = "none" | "sandbox" | "desktop" | "fabric" | "local";

export interface CloudSession {
  id: string;
  agent_id?: string;
  status?: string;
  computer?: { kind?: string; id?: string | null };
  budget?: {
    estimated_cost_usd?: number;
    charged?: boolean;
  };
  created_at?: string;
  updated_at?: string;
}

export function buildSessionBody(input: {
  model: string;
  instructions: string;
  prompt: string;
  computerKind: ComputerKind;
  maxCostUsd?: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    agent: {
      model: input.model.trim() || "default",
      instructions: input.instructions.trim() || undefined,
    },
    computer: { kind: input.computerKind || "none" },
    input: input.prompt.trim() || undefined,
  };
  if (input.maxCostUsd != null && Number.isFinite(input.maxCostUsd)) {
    body.budget = { max_cost_usd: input.maxCostUsd };
  }
  return body;
}

export function sessionCreateCurl(body: Record<string, unknown>): string {
  return [
    `curl -X POST https://api.allternit.com/api/v1/sessions \\`,
    `  -H "Authorization: Bearer $TOKEN" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${JSON.stringify(body)}'`,
  ].join("\n");
}

export async function createCloudSession(body: Record<string, unknown>): Promise<
  | { ok: true; session: CloudSession }
  | { ok: false; unavailable: boolean; error: string; code?: string }
> {
  const response = await api.raw("/api/v1/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as {
    session?: CloudSession;
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
  if (!response.ok || !json.session?.id) {
    return {
      ok: false,
      unavailable: false,
      error: json.error || json.message || `HTTP ${response.status}`,
      code: json.code,
    };
  }
  return { ok: true, session: json.session };
}

export async function listCloudSessions(): Promise<CloudSession[]> {
  const body = await api.get<{ sessions?: CloudSession[] }>("/api/v1/sessions");
  return Array.isArray(body.sessions) ? body.sessions : [];
}

export async function sendCloudEvent(
  sessionId: string,
  type: "user.interrupt" | "user.message",
  content?: string,
): Promise<void> {
  await api.post(`/api/v1/sessions/${encodeURIComponent(sessionId)}/events`, {
    events: content ? [{ type, content }] : [{ type }],
  });
}

export async function archiveCloudSession(sessionId: string): Promise<void> {
  await api.post(`/api/v1/sessions/${encodeURIComponent(sessionId)}/archive`, {});
}

export function parseSseChunk(
  buffer: string,
  onEvent: (event: { type?: string }) => void,
): string {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const block of parts) {
    const dataLines = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());
    if (!dataLines.length) continue;
    try {
      onEvent(JSON.parse(dataLines.join("\n")) as { type?: string });
    } catch {
      onEvent({ type: "raw" });
    }
  }
  return rest;
}

export { AllternitApiError };
