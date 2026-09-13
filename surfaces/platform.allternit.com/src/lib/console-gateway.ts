/**
 * Virtual-key access to the public OpenAI-compatible gateway (`/v1/*`).
 *
 * The `/v1/chat/completions`, `/v1/files`, and `/v1/batches` routes authenticate
 * with gateway virtual keys (`Authorization: Bearer ak-…`, see
 * `cmd/allternit-api/src/llm_gateway/auth.rs::llm_key_middleware`), NOT with the
 * Clerk session token the console api client normally sends. Key management is
 * Clerk-protected at `/api/v1/gateway/keys`; the full plaintext key is returned
 * exactly once at creation.
 *
 * Console pattern: on first use, create a dedicated "Console" virtual key for
 * the signed-in user, keep it in localStorage, and send it as an explicit
 * Authorization override on `/v1/*` calls. The key is user-scoped and has no
 * budget or model restrictions unless set via the API.
 */

import { api } from "@/lib/api-client";

const STORAGE_KEY = "allternit:console:gateway-key";

let cached: string | null = null;

export function getStoredGatewayKey(): string | null {
  if (cached) return cached;
  try {
    cached = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    cached = null;
  }
  return cached;
}

function storeGatewayKey(key: string): void {
  cached = key;
  try {
    window.localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Storage unavailable — the key still works for this session via the cache.
  }
}

/**
 * Return the console's virtual key, creating and persisting one on first use.
 * Throws (with the API error message) when key creation is refused.
 */
export async function ensureConsoleGatewayKey(): Promise<string> {
  const existing = getStoredGatewayKey();
  if (existing) return existing;

  const created = await api.post<{
    id: string;
    key: string;
    key_prefix: string;
    warning?: string;
  }>("/api/v1/gateway/keys", { name: "Console (auto-created)" });

  storeGatewayKey(created.key);
  return created.key;
}

export function forgetStoredGatewayKey(): void {
  cached = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** RequestInit headers that authenticate a `/v1/*` call with the virtual key. */
export function gatewayAuthOptions(
  key: string,
  extra: RequestInit = {}
): RequestInit {
  return {
    ...extra,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(extra.headers as Record<string, string> | undefined),
    },
  };
}

// ─── Shared OpenAI-shaped types for the gateway surface ─────────────────────

export interface OpenAiFileObject {
  id: string;
  object: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  status: string;
  content_type?: string | null;
}

export interface OpenAiListResponse<T> {
  object: string;
  data: T[];
}

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatCompletionChunk {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index: number;
    delta?: { role?: string; content?: string };
    message?: { role?: string; content?: string };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface OpenAiBatchRequestCounts {
  total: number;
  completed: number;
  failed: number;
}

export interface OpenAiBatch {
  id: string;
  object: string;
  status:
    | "validating"
    | "in_progress"
    | "finalizing"
    | "completed"
    | "failed"
    | "expired"
    | "cancelling"
    | "cancelled"
    | string;
  endpoint: string;
  input_file_id: string;
  completion_window: string;
  output_file_id?: string | null;
  error_file_id?: string | null;
  request_counts: OpenAiBatchRequestCounts;
  created_at: number;
  expires_at?: number | null;
  completed_at?: number | null;
  failed_at?: number | null;
  cancelled_at?: number | null;
  metadata?: Record<string, unknown> | null;
}
