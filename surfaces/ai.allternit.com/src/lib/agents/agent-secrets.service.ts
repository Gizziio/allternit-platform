/**
 * Agent Secrets Service
 *
 * Vault-backed operations for agent secret references.
 * The actual secret material is never persisted in the agent record;
 * it is sealed separately via the backend and only resolved at runtime.
 */

import { API_BASE_URL } from '@/lib/agents/api-config';

export interface SealSecretInput {
  agentId: string;
  key: string;
  value: string;
}

export interface SealSecretsResult {
  sealed: string[];
  failed: Array<{ key: string; error: string }>;
}

/**
 * Seal a single secret value for an agent.
 * The value is encrypted server-side and stored outside the agent record.
 */
export async function sealAgentSecret(input: SealSecretInput): Promise<void> {
  const { agentId, key, value } = input;
  const res = await fetch(
    `${API_BASE_URL}/agents/${encodeURIComponent(agentId)}/secrets/${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to seal secret ${key}: ${body}`);
  }
}

/**
 * Seal multiple secret values for an agent.
 * Returns which keys were sealed and which failed. Failures do not stop the batch.
 */
export async function sealAgentSecrets(agentId: string, secrets: Array<{ key: string; value: string }>): Promise<SealSecretsResult> {
  const result: SealSecretsResult = { sealed: [], failed: [] };

  await Promise.all(
    secrets.map(async ({ key, value }) => {
      try {
        await sealAgentSecret({ agentId, key, value });
        result.sealed.push(key);
      } catch (err) {
        result.failed.push({
          key,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    })
  );

  return result;
}
