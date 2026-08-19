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
  provider: string;
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
