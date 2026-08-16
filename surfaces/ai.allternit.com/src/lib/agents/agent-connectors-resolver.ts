/**
 * Agent Connectors Resolver
 *
 * Resolves declared connector bindings into runtime credentials. The actual
 * OAuth/API-key material stays in the connector store; only the resolved env
 * map is handed to the session runtime.
 */

import { apiRequest } from './api-config';
import type { AgentConnectorBinding } from './agent.types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('AgentConnectorsResolver');

export interface ResolvedConnectorCredential {
  connectorId: string;
  provider: string;
  key: string;
  value: string;
  source: string;
}

export interface ConnectorsResolutionResult {
  credentials: ResolvedConnectorCredential[];
  missing: string[];
  errors: string[];
}

/**
 * Resolve an agent's connector bindings for a session start.
 */
export async function resolveAgentConnectors(
  agentId: string,
  bindings: AgentConnectorBinding[] = [],
): Promise<ConnectorsResolutionResult> {
  if (bindings.length === 0) {
    return { credentials: [], missing: [], errors: [] };
  }

  try {
    const result = await apiRequest<ConnectorsResolutionResult>(
      `/api/v1/agents/${encodeURIComponent(agentId)}/connectors/resolve`,
      {
        method: 'POST',
        body: JSON.stringify({ bindings }),
      },
    );
    return result;
  } catch (err) {
    logger.error({ err, agentId }, 'Failed to resolve agent connectors');
    return {
      credentials: [],
      missing: bindings.map((b) => b.label || b.provider),
      errors: [err instanceof Error ? err.message : 'Unknown error'],
    };
  }
}

/**
 * Build a plain env map from resolved connector credentials.
 */
export function connectorsToEnvMap(credentials: ResolvedConnectorCredential[]): Record<string, string> {
  return credentials.reduce<Record<string, string>>((acc, c) => {
    acc[c.key] = c.value;
    return acc;
  }, {});
}
