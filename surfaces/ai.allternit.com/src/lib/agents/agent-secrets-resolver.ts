/**
 * Agent Secrets Resolver
 *
 * Resolves declared secret references into runtime env/env values without
 * leaking secret material into the agent record. The actual values stay in
 * the vault and are only fetched when a bot session starts.
 */

import { apiRequest } from './api-config';
import type { AgentSecretRef } from './agent.types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('AgentSecretsResolver');

export interface ResolvedSecret {
  key: string;
  value: string;
  source: 'vault' | 'runtime_inject' | 'env';
}

export interface SecretsResolutionResult {
  secrets: ResolvedSecret[];
  missing: string[];
  errors: string[];
}

/**
 * Resolve an agent's secret references for a session start.
 *
 * Calls the production secrets resolution endpoint. If the backend returns
 * 501 (endpoint unavailable in this environment), it degrades gracefully so
 * the session can still start, with required secrets reported as missing.
 */
export async function resolveAgentSecrets(
  agentId: string,
  refs: AgentSecretRef[] = [],
): Promise<SecretsResolutionResult> {
  if (refs.length === 0) {
    return { secrets: [], missing: [], errors: [] };
  }

  try {
    const result = await apiRequest<SecretsResolutionResult>(
      `/api/v1/agents/${encodeURIComponent(agentId)}/secrets/resolve`,
      {
        method: 'POST',
        body: JSON.stringify({ refs }),
      },
    );
    return result;
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 501) {
      logger.warn(
        { agentId },
        'Agent secrets resolver endpoint unavailable (501); continuing without injected secrets',
      );
      return {
        secrets: [],
        missing: refs.filter((r) => r.required).map((r) => r.key),
        errors: [],
      };
    }
    logger.error({ err, agentId }, 'Failed to resolve agent secrets');
    return {
      secrets: [],
      missing: refs.filter((r) => r.required).map((r) => r.key),
      errors: [err instanceof Error ? err.message : 'Unknown error'],
    };
  }
}

/**
 * Build a plain env map from resolved secrets for passing to a subprocess or
 * local harness.
 */
export function secretsToEnvMap(secrets: ResolvedSecret[]): Record<string, string> {
  return secrets.reduce<Record<string, string>>((acc, s) => {
    acc[s.key] = s.value;
    return acc;
  }, {});
}
