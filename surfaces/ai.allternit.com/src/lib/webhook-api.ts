"use client";

/**
 * Webhook Trigger API Client
 *
 * Typed client for /api/v1/webhook-triggers and delivery logs.
 */

import { api } from '@/integration/api-client';

export type WebhookExecutionMode =
  | 'PLAN_ONLY'
  | 'REQUIRE_APPROVAL'
  | 'ACCEPT_EDITS'
  | 'BYPASS_PERMISSIONS';

export interface WebhookTrigger {
  id: string;
  user_id: string;
  org_id?: string | null;
  name: string;
  source: string;
  event_type: string;
  target_agent_id: string;
  prompt_template?: string | null;
  execution_mode: WebhookExecutionMode;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookTriggerDelivery {
  id: string;
  trigger_id: string;
  event: string;
  payload: Record<string, unknown>;
  signature_valid: boolean;
  status: 'pending' | 'accepted' | 'rejected' | 'failed';
  ticket_id?: string | null;
  error?: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export interface CreateWebhookTriggerInput {
  name: string;
  source: string;
  event_type: string;
  target_agent_id: string;
  prompt_template?: string | null;
  execution_mode?: WebhookExecutionMode;
  secret: string;
}

export interface UpdateWebhookTriggerInput {
  name?: string;
  source?: string;
  event_type?: string;
  target_agent_id?: string;
  prompt_template?: string | null;
  execution_mode?: WebhookExecutionMode;
  secret?: string;
  active?: boolean;
}

export interface WebhookTriggerListResponse {
  triggers: WebhookTrigger[];
  total: number;
}

export interface WebhookTriggerDeliveryListResponse {
  deliveries: WebhookTriggerDelivery[];
  total: number;
}

export async function listWebhookTriggers(): Promise<WebhookTrigger[]> {
  const res = await api.get<WebhookTriggerListResponse>('/api/v1/webhook-triggers');
  return res.triggers ?? [];
}

export async function createWebhookTrigger(
  input: CreateWebhookTriggerInput,
): Promise<WebhookTrigger> {
  const res = await api.post<{ trigger: WebhookTrigger }>('/api/v1/webhook-triggers', input);
  return res.trigger;
}

export async function getWebhookTrigger(id: string): Promise<WebhookTrigger> {
  const res = await api.get<{ trigger: WebhookTrigger }>(`/api/v1/webhook-triggers/${id}`);
  return res.trigger;
}

export async function updateWebhookTrigger(
  id: string,
  input: UpdateWebhookTriggerInput,
): Promise<WebhookTrigger> {
  const res = await api.patch<{ trigger: WebhookTrigger }>(`/api/v1/webhook-triggers/${id}`, input);
  return res.trigger;
}

export async function deleteWebhookTrigger(id: string): Promise<void> {
  await api.delete(`/api/v1/webhook-triggers/${id}`);
}

export async function listWebhookTriggerDeliveries(
  id: string,
): Promise<WebhookTriggerDelivery[]> {
  const res = await api.get<WebhookTriggerDeliveryListResponse>(
    `/api/v1/webhook-triggers/${id}/deliveries`,
  );
  return res.deliveries ?? [];
}

export function getWebhookInboundUrl(triggerId: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/webhooks/inbound/${triggerId}`;
}
