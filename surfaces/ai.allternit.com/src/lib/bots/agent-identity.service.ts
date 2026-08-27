/**
 * Agent Identity Channel Service
 *
 * Binds platform-native email / phone identity channels to bots.
 *   - CommRails email  → POST /api/v1/agents/:id/identity/email
 *   - Vapi phone       → POST /api/v1/agents/:id/identity/phone
 *
 * These endpoints provision real addresses/numbers from the platform pool
 * (ALLTERNIT_BOT_EMAIL_DOMAIN / ALLTERNIT_BOT_PHONE_POOL). External providers
 * (Twilio, Telnyx, Photon, Gmail, etc.) are handled through the owned-connector
 * stack, not this service.
 */

import { apiRequestWithError } from '@/lib/agents/api-config';

export interface ProvisionAgentEmailResult {
  address: string;
  /** 'mailflare' when the mailflare rail is configured; 'commrails' is the legacy mint-only fallback. */
  provider: 'mailflare' | 'commrails';
}

export interface ProvisionAgentPhoneResult {
  number: string;
  provider: string;
}

export async function provisionAgentEmail(agentId: string): Promise<ProvisionAgentEmailResult> {
  return apiRequestWithError<ProvisionAgentEmailResult>(
    `/api/v1/agents/${encodeURIComponent(agentId)}/identity/email`,
    { method: 'POST' },
  );
}

export async function provisionAgentPhone(agentId: string): Promise<ProvisionAgentPhoneResult> {
  return apiRequestWithError<ProvisionAgentPhoneResult>(
    `/api/v1/agents/${encodeURIComponent(agentId)}/identity/phone`,
    { method: 'POST' },
  );
}

/** Shape of `GET /api/v1/agent-email/status` (agent_email_routes.rs). */
export interface AgentEmailRailStatus {
  configured: boolean;
  /** Present only when configured. */
  domain?: string;
  baseUrl?: string;
  webhookSecretSet?: boolean;
  reachable?: boolean;
}

export async function getAgentEmailStatus(): Promise<AgentEmailRailStatus> {
  return apiRequestWithError<AgentEmailRailStatus>('/api/v1/agent-email/status');
}
