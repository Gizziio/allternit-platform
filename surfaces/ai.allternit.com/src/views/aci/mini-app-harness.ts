import { createAgent, listAgents, updateAgent } from '@/lib/agents/agent.service';
import { defineAgent } from '@/lib/agents/agent-definition';
import type { HarnessConfig } from '@/lib/agents/agent.types';
import type { InstalledMiniApp, MiniAppHarnessContract } from './mini-app.types';
import { gizziBaseUrl } from '@/lib/agents/api-config';

export type MiniAppHarnessReadiness =
  | { ready: true; harness: HarnessConfig }
  | { ready: false; reason: string };

export function toAllternitHarness(contract?: MiniAppHarnessContract): MiniAppHarnessReadiness {
  if (!contract) return { ready: false, reason: 'Mini-app does not declare an execution harness.' };
  if (contract.transport === 'http' && contract.baseURL) {
    return { ready: true, harness: { mode: 'local', local: { baseURL: contract.baseURL } } };
  }
  if (contract.transport === 'subprocess' && contract.command) {
    return { ready: true, harness: { mode: 'subprocess', subprocess: { command: contract.command, cwd: contract.cwd, env: contract.env } } };
  }
  return {
    ready: false,
    reason: `${contract.transport.toUpperCase()} requires a dedicated Gizzi adapter and cannot use the generic subprocess harness.`,
  };
}

export async function ensureMiniAppAgent(app: InstalledMiniApp): Promise<{ agentId: string } | { ready: false; reason: string }> {
  let contract = app.harness;
  if (contract?.transport === 'acp' && contract.command) {
    const [command, ...args] = contract.command.trim().split(/\s+/);
    const response = await fetch(`${gizziBaseUrl()}/acp/spawn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: app.id, agentName: app.name, command, args, cwd: contract.cwd, env: contract.env }),
    });
    const spawned = await response.json() as { connectionId?: string; error?: string };
    if (!response.ok || !spawned.connectionId) return { ready: false, reason: spawned.error ?? 'ACP agent failed to start.' };
    contract = { transport: 'http', baseURL: `${gizziBaseUrl()}/acp/connections/${spawned.connectionId}/v1`, model: contract.model };
  }
  const readiness = toAllternitHarness(contract);
  if (!readiness.ready) return readiness;
  const tag = `mini-app:${app.id}`;
  const existing = (await listAgents()).find((agent) => agent.tags?.includes(tag));
  if (existing) {
    await updateAgent(existing.id, {
      model: contract?.model ?? app.id,
      provider: contract?.transport === 'http' ? 'local' : 'custom',
      harness: readiness.harness,
      config: { ...existing.config, miniAppId: app.id, repo: app.repo, surface: app.surface },
    });
    return { agentId: existing.id };
  }

  const agent = await createAgent(defineAgent({
    name: `${app.name} via Allternit`,
    description: `Allternit-managed integration for ${app.name}. All tasks enter through the platform session, policy, skill, and receipt system.`,
    type: 'specialist',
    model: contract?.model ?? app.id,
    provider: contract?.transport === 'http' ? 'local' : 'custom',
    capabilities: ['mini-app', contract?.transport ?? 'unknown'],
    source: 'vendor',
    harness: readiness.harness,
    allowedSurfaces: ['chat', 'browser', 'cowork'],
    tags: ['mini-app', tag],
    config: { source: 'mini-app', miniAppId: app.id, repo: app.repo, surface: app.surface },
  }));
  return { agentId: agent.id };
}
