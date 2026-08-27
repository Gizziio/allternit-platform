"use client";

/**
 * Webhook Trigger API Client
 *
 * Typed client for /api/v1/webhook-triggers and delivery logs.
 */

import { api } from "@/integration/api-client";

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
  status: "pending" | "delivered" | "failed";
  response_status: number | null;
  error: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export interface CreateWebhookTriggerInput {
  name: string;
  target_bot_id: string;
}

export interface UpdateWebhookTriggerInput {
  name?: string;
  target_bot_id?: string;
  active?: boolean;
}

export function getWebhookInboundUrl(triggerId: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/webhooks/inbound/${triggerId}`;
}

export async function listWebhookTriggers(): Promise<WebhookTrigger[]> {
  const res = await api.get<{ triggers: WebhookTrigger[] }>(
    "/api/v1/webhook-triggers"
  );
  return res.triggers ?? [];
}

export async function createWebhookTrigger(
  input: CreateWebhookTriggerInput
): Promise<WebhookTrigger> {
  const res = await api.post<{ trigger: WebhookTrigger }>(
    "/api/v1/webhook-triggers",
    input
  );
  return res.trigger;
}

export async function getWebhookTrigger(id: string): Promise<WebhookTrigger> {
  const res = await api.get<{ trigger: WebhookTrigger }>(
    `/api/v1/webhook-triggers/${id}`
  );
  return res.trigger;
}

export async function updateWebhookTrigger(
  id: string,
  input: UpdateWebhookTriggerInput
): Promise<WebhookTrigger> {
  const res = await api.patch<{ trigger: WebhookTrigger }>(
    `/api/v1/webhook-triggers/${id}`,
    input
  );
  return res.trigger;
}

export async function deleteWebhookTrigger(id: string): Promise<void> {
  await api.delete(`/api/v1/webhook-triggers/${id}`);
}

export async function listWebhookTriggerDeliveries(
  id: string
): Promise<WebhookTriggerDelivery[]> {
  const res = await api.get<{ deliveries: WebhookTriggerDelivery[] }>(
    `/api/v1/webhook-triggers/${id}/deliveries`
  );
  return res.deliveries ?? [];
}
