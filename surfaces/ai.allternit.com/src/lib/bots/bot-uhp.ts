/**
 * UHP spawn for Bot Agents BA-7 leftover.
 * Talks to `ao serve` (default 127.0.0.1:8410). Fail-closed; never falls back
 * to Allternit cloud.
 */

const DEFAULT_UHP_URL = "http://127.0.0.1:8410";
const UHP_VERSION = "2026-08-11";

export function uhpBaseUrl(): string {
  if (typeof window !== "undefined") {
    const win = window as unknown as Record<string, unknown>;
    const fromWin = typeof win.__ALLTERNIT_UHP_URL__ === "string" ? (win.__ALLTERNIT_UHP_URL__ as string) : "";
    if (fromWin) return fromWin.replace(/\/+$/, "");
  }
  const fromEnv =
    (typeof process !== "undefined" && process.env?.UHP_URL) ||
    (typeof process !== "undefined" && process.env?.ALLTERNIT_UHP_URL) ||
    "";
  return (fromEnv || DEFAULT_UHP_URL).replace(/\/+$/, "");
}

function uhpToken(): string {
  if (typeof window !== "undefined") {
    const win = window as unknown as Record<string, unknown>;
    if (typeof win.__ALLTERNIT_UHP_TOKEN__ === "string") return win.__ALLTERNIT_UHP_TOKEN__ as string;
  }
  return (
    (typeof process !== "undefined" && (process.env?.UHP_TOKEN || process.env?.ALLTERNIT_UHP_TOKEN)) ||
    ""
  );
}

export async function spawnUhpHarness(
  harnessId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ sessionId?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "UHP-Version": UHP_VERSION,
  };
  const token = uhpToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchImpl(`${uhpBaseUrl()}/v1/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      harness: harnessId,
      input: "Allternit bot session",
      background: true,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`UHP spawn failed: HTTP ${response.status}${detail ? ` ${detail}` : ""}`);
  }
  const body = (await response.json()) as {
    id?: string;
    metadata?: { session_id?: string };
  };
  return { sessionId: body.metadata?.session_id || body.id };
}
