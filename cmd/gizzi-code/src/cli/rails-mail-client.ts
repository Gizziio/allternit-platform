/**
 * Rails Mail client — read-capable client for `gizzi mail` (Agent Activity
 * CLI phase 1), talking to the same backend as
 * `runtime/server/rails-bridge.ts` (`cmd/allternit-api/src/rails/mod.rs`,
 * routes registered at rails/mod.rs:179-188).
 *
 * `rails-bridge.ts` only ever writes (`/mail/send`, `/mail/decide` on the
 * executor-lifecycle path); this client adds the read paths (`/mail/threads`,
 * `/mail/thread/:id`, `/ledger/tail`) alongside it, for a human at the CLI
 * rather than the orchestrator. Same base URL + no-auth-header pattern as
 * `rails-bridge.ts` (duplicated here since `RAILS_BASE` isn't exported
 * there): `cmd/allternit-api/src/auth.rs:730-746` skips Clerk auth entirely
 * for localhost-origin requests when `local_dev_bypass()` is enabled, which
 * is the common case for a CLI user running against their own local
 * allternit-api instance. A remote/authenticated instance is out of scope,
 * same as it already is for `rails-bridge.ts`.
 */

import { gatewayUrl } from "@/shared/constants/allternitGateway"

const RAILS_BASE = process.env.GIZZI_RAILS_URL ?? gatewayUrl("/api/rails")

export interface MailThreadSummary {
  thread_id: string
  messages: number
  last_ts: string
}

export interface MailMessage {
  message_id: string
  thread_id: string
  from_agent: string
  body: unknown
  event_type: string
  timestamp: string
}

export interface LedgerEvent {
  event_id: string
  event_type: string
  timestamp: string
  payload: unknown
}

async function railsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${RAILS_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  })
  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`rails ${path} failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`)
  }
  return (await response.json()) as T
}

/** `GET /mail/threads` → `{ threads: [{ thread_id, messages, last_ts }] }`. */
export async function listThreads(): Promise<MailThreadSummary[]> {
  const data = await railsFetch<{ threads: MailThreadSummary[] }>("/mail/threads")
  return data.threads
}

/** `GET /mail/thread/:thread_id` → `{ messages: [...] }`. */
export async function readThread(threadId: string): Promise<MailMessage[]> {
  const data = await railsFetch<{ messages: MailMessage[] }>(`/mail/thread/${encodeURIComponent(threadId)}`)
  return data.messages
}

/**
 * `POST /mail/send` body `{ thread, body }` → `{ sent, thread_id,
 * message_id? }`. `message_id` is only present on the typed-envelope send
 * path (`from_agent` set); this legacy `{ thread, body }` shape omits it
 * (`mail_send`, rails/mod.rs:655-663), so it's typed optional here.
 */
export async function sendMessage(
  threadId: string,
  body: string,
): Promise<{ sent: boolean; thread_id: string; message_id?: string }> {
  return railsFetch("/mail/send", {
    method: "POST",
    body: JSON.stringify({ thread: threadId, body }),
  })
}

/**
 * `POST /mail/decide` body `{ thread, approve }` → `{ decided, thread_id }`.
 * `approve` is strictly boolean server-side — no N-way decision.
 */
export async function decide(threadId: string, approve: boolean): Promise<{ decided: boolean; thread_id: string }> {
  return railsFetch("/mail/decide", {
    method: "POST",
    body: JSON.stringify({ thread: threadId, approve }),
  })
}

/** `POST /ledger/tail` body `{ count }` → bare `UiLedgerEvent[]`, no envelope. */
export async function tailLedger(count: number): Promise<LedgerEvent[]> {
  return railsFetch("/ledger/tail", {
    method: "POST",
    body: JSON.stringify({ count }),
  })
}
