/**
 * Webhook clients — outbound subscriptions (workspace events) and inbound
 * trigger webhooks (external systems → Allternit bots).
 *
 * Subscriptions (cmd/allternit-api/src/webhook_subscription_routes.rs:148-157):
 *   GET    /api/v1/beta/webhooks               -> { subscriptions, total }
 *   POST   /api/v1/beta/webhooks               -> { subscription } (secret required)
 *   PATCH  /api/v1/beta/webhooks/:id           -> { subscription }
 *   DELETE /api/v1/beta/webhooks/:id           -> 204
 *   GET    /api/v1/beta/webhooks/:id/deliveries?limit=&status=&page=
 *                                              -> { deliveries, total, page, limit }
 *
 * Triggers (cmd/allternit-api/src/webhook_trigger_routes.rs:34-49):
 *   GET    /api/v1/webhook-triggers            -> { triggers, total }
 *   POST   /api/v1/webhook-triggers            -> { trigger } ({ name, target_bot_id })
 *   PATCH  /api/v1/webhook-triggers/:id        -> { trigger }
 *   DELETE /api/v1/webhook-triggers/:id        -> 204
 *   GET    /api/v1/webhook-triggers/:id/deliveries -> { deliveries, total }
 *
 * Both surfaces require an active organization. The validated subscription
 * event registry lives in webhook_subscription_routes.rs:31-79.
 */

import { api } from "@/lib/api-client";

/** Validated event registry (webhook_subscription_routes.rs `events::ALL`). */
export const WEBHOOK_EVENTS = [
  "agent.created",
  "agent.updated",
  "agent.archived",
  "session.created",
  "session.event_created",
  "session.archived",
  "session.over_budget",
  "deployment.run_created",
  "deployment.run_updated",
  "billing.credit_purchase",
  "key.created",
  "key.revoked",
] as const;

/** Wildcard subscription — must be the only entry. */
export const WEBHOOK_EVENT_WILDCARD = "*";

export type WebhookDeliveryStatus = "pending" | "delivered" | "failed";

export interface WebhookSubscription {
  id: string;
  org_id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  event_type: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  response_status: number | null;
  response_body: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookTrigger {
  id: string;
  org_id: string;
  name: string;
  target_bot_id: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookTriggerDelivery {
  id: string;
  trigger_id: string;
  event: string | null;
  status: WebhookDeliveryStatus;
  response_status: number | null;
  error: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
}

// ─── Subscriptions ──────────────────────────────────────────────────────────

export async function listWebhookSubscriptions(): Promise<WebhookSubscription[]> {
  const data = await api.get<{ subscriptions: WebhookSubscription[] }>("/api/v1/beta/webhooks");
  return data.subscriptions ?? [];
}

export async function createWebhookSubscription(input: {
  url: string;
  events: string[];
  secret: string;
}): Promise<WebhookSubscription> {
  const data = await api.post<{ subscription: WebhookSubscription }>("/api/v1/beta/webhooks", input);
  return data.subscription;
}

export async function updateWebhookSubscription(
  id: string,
  input: { url?: string; events?: string[]; secret?: string; active?: boolean }
): Promise<WebhookSubscription> {
  const data = await api.patch<{ subscription: WebhookSubscription }>(
    `/api/v1/beta/webhooks/${id}`,
    input
  );
  return data.subscription;
}

export async function deleteWebhookSubscription(id: string): Promise<void> {
  await api.delete(`/api/v1/beta/webhooks/${id}`);
}

export async function listWebhookDeliveries(
  id: string,
  options: { limit?: number; status?: WebhookDeliveryStatus } = {}
): Promise<WebhookDelivery[]> {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.status) params.set("status", options.status);
  const qs = params.toString();
  const data = await api.get<{ deliveries: WebhookDelivery[] }>(
    `/api/v1/beta/webhooks/${id}/deliveries${qs ? `?${qs}` : ""}`
  );
  return data.deliveries ?? [];
}

// ─── Triggers ───────────────────────────────────────────────────────────────

/** Public inbound receiver URL for a trigger (mounted on the gateway). */
export function getWebhookInboundUrl(triggerId: string): string {
  const base = (import.meta.env.VITE_ALLTERNIT_GATEWAY_URL || "https://api.allternit.com")
    .toString()
    .replace(/\/+$/, "");
  return `${base}/webhooks/inbound/${triggerId}`;
}

export async function listWebhookTriggers(): Promise<WebhookTrigger[]> {
  const data = await api.get<{ triggers: WebhookTrigger[] }>("/api/v1/webhook-triggers");
  return data.triggers ?? [];
}

export async function createWebhookTrigger(input: {
  name: string;
  target_bot_id: string;
}): Promise<WebhookTrigger> {
  const data = await api.post<{ trigger: WebhookTrigger }>("/api/v1/webhook-triggers", input);
  return data.trigger;
}

export async function updateWebhookTrigger(
  id: string,
  input: { name?: string; target_bot_id?: string; active?: boolean }
): Promise<WebhookTrigger> {
  const data = await api.patch<{ trigger: WebhookTrigger }>(
    `/api/v1/webhook-triggers/${id}`,
    input
  );
  return data.trigger;
}

export async function deleteWebhookTrigger(id: string): Promise<void> {
  await api.delete(`/api/v1/webhook-triggers/${id}`);
}

export async function listWebhookTriggerDeliveries(id: string): Promise<WebhookTriggerDelivery[]> {
  const data = await api.get<{ deliveries: WebhookTriggerDelivery[] }>(
    `/api/v1/webhook-triggers/${id}/deliveries`
  );
  return data.deliveries ?? [];
}
