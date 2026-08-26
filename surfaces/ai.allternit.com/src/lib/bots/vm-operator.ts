/**
 * VM Operator — OpenSandbox integration point
 *
 * Thin client for dispatching bot tasks to a sandbox runtime. The runtime can
 * be OpenSandbox, Docker, Kubernetes, or a local runner. This module is the
 * schema-level bridge: it exposes the operations a bot needs to run code,
 * operate a browser, read/write files, and stream a desktop.
 *
 * Actual HTTP calls are environment-gated. When no sandbox server is
 * configured, the module returns a clear "not configured" result so the bot
 * runtime can fall back to chat/local execution.
 */

import type { AgentVMOperatorConfig } from '@/lib/agents/agent.types';
import { API_BASE_URL } from '@/lib/agents/api-config';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { createModuleLogger } from '@/lib/logger';
import {
  createComputer,
  listComputers,
  type Computer,
  type CreateComputerResponse,
} from '@/lib/computers-api';

const logger = createModuleLogger('VMOperator');

export interface Sandbox {
  id: string;
  agentId: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  provider: string;
  image?: string;
  vncUrl?: string;
  persistence?: 'ephemeral' | 'session' | 'persistent';
  createdAt: string;
  lastActiveAt?: string;
}

export interface SandboxSnapshot {
  id: string;
  sandboxId: string;
  label?: string;
  createdAt: string;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface BrowserTaskResult {
  success: boolean;
  url: string;
  summary?: string;
  artifacts?: Array<{ path: string; type: string }>;
}

export interface VMOperatorResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

function getSandboxBaseURL(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return (
    (window as any).ALLTERNIT_SANDBOX_URL ||
    process.env.NEXT_PUBLIC_SANDBOX_URL ||
    undefined
  );
}

function notConfigured<T>(): VMOperatorResult<T> {
  return {
    ok: false,
    error:
      'Sandbox runtime is not configured. Set ALLTERNIT_SANDBOX_URL or process.env.NEXT_PUBLIC_SANDBOX_URL to connect to OpenSandbox.',
  };
}

function mapStatus(status: string): Sandbox['status'] {
  switch (status) {
    case 'creating':
      return 'creating';
    case 'running':
      return 'running';
    case 'stopped':
      return 'stopped';
    case 'error':
    default:
      return 'error';
  }
}

function mapComputerToSandbox(computer: Computer, agentId: string): Sandbox {
  return {
    id: computer.id,
    agentId: computer.bot_id ?? agentId,
    status: mapStatus(computer.status),
    provider: computer.provider,
    persistence:
      (computer as unknown as { persistence?: Sandbox['persistence'] }).persistence ?? undefined,
    createdAt: computer.created_at,
    lastActiveAt: computer.updated_at,
  };
}

function mapCreateResponseToSandbox(
  agentId: string,
  config: AgentVMOperatorConfig,
  response: CreateComputerResponse,
): Sandbox {
  return {
    id: response.id || response.sandbox_id || '',
    agentId,
    status: mapStatus(response.status),
    provider: response.provider ?? config.provider,
    persistence: response.persistence ?? config.persistence,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a sandbox for the given bot/agent.
 *
 * Provisions through the unified `/api/v1/computers` control plane so cloud
 * desktops are owned by the bot and tracked in the org credit ledger.
 */
export async function createSandbox(
  agentId: string,
  config: AgentVMOperatorConfig,
): Promise<VMOperatorResult<Sandbox>> {
  try {
    const response = await createComputer({
      kind: config.computerKind ?? 'cloud_desktop',
      bot_id: agentId,
      template_id: config.templateId,
      persistence: config.persistence,
    });
    const sandbox = mapCreateResponseToSandbox(agentId, config, response);
    return { ok: true, data: sandbox };
  } catch (err) {
    logger.error({ err, agentId }, 'Failed to create sandbox');
    return { ok: false, error: err instanceof Error ? err.message : 'Sandbox creation failed' };
  }
}

/**
 * Find an existing sandbox owned by an agent.
 *
 * This is the key to the persistent workspace model: instead of creating a
 * fresh sandbox for every session, we reuse the agent's already-running
 * computer so state (installed tools, files, browser sessions, memory) survives.
 */
export async function getSandboxForAgent(
  agentId: string,
): Promise<VMOperatorResult<Sandbox>> {
  try {
    const computers = await listComputers({ bot_id: agentId, kind: 'cloud_desktop' });
    const active = computers
      .filter(
        (c) =>
          c.bot_id === agentId &&
          c.status !== 'deleted' &&
          (c.status === 'running' || c.status === 'creating'),
      )
      .sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime(),
      )[0];

    if (!active) {
      return { ok: false, error: `No active sandbox found for agent ${agentId}` };
    }

    return { ok: true, data: mapComputerToSandbox(active, agentId) };
  } catch (err) {
    logger.error({ err, agentId }, 'Failed to find sandbox for agent');
    return { ok: false, error: err instanceof Error ? err.message : 'Sandbox lookup failed' };
  }
}

/**
 * Create a snapshot of a sandbox for rollback / reproducibility.
 */
export async function snapshotSandbox(
  sandboxId: string,
  label?: string,
): Promise<VMOperatorResult<SandboxSnapshot>> {
  const baseURL = getSandboxBaseURL();
  if (!baseURL) return notConfigured<SandboxSnapshot>();

  try {
    const res = await fetch(`${baseURL}/sandboxes/${encodeURIComponent(sandboxId)}/snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label || `snapshot-${Date.now()}` }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sandbox server returned ${res.status}: ${text}`);
    }

    const data = (await res.json()) as SandboxSnapshot;
    return { ok: true, data };
  } catch (err) {
    logger.error({ err, sandboxId }, 'Failed to snapshot sandbox');
    return { ok: false, error: err instanceof Error ? err.message : 'Snapshot failed' };
  }
}

/**
 * Restore a sandbox to a previous snapshot.
 */
export async function restoreSandbox(
  sandboxId: string,
  snapshotId: string,
): Promise<VMOperatorResult<Sandbox>> {
  const baseURL = getSandboxBaseURL();
  if (!baseURL) return notConfigured<Sandbox>();

  try {
    const res = await fetch(
      `${baseURL}/sandboxes/${encodeURIComponent(sandboxId)}/snapshots/${encodeURIComponent(snapshotId)}/restore`,
      { method: 'POST' },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sandbox server returned ${res.status}: ${text}`);
    }

    const data = (await res.json()) as Sandbox;
    return { ok: true, data };
  } catch (err) {
    logger.error({ err, sandboxId, snapshotId }, 'Failed to restore sandbox');
    return { ok: false, error: err instanceof Error ? err.message : 'Restore failed' };
  }
}

/**
 * Run a shell command inside a sandbox.
 */
export async function runCommand(
  sandboxId: string,
  command: string,
  agentId?: string,
): Promise<VMOperatorResult<CommandResult>> {
  if (agentId && isBotDesktopPaused(agentId)) {
    return pausedResult<CommandResult>();
  }

  const baseURL = getSandboxBaseURL();
  if (!baseURL) return notConfigured<CommandResult>();

  try {
    const res = await fetch(`${baseURL}/sandboxes/${encodeURIComponent(sandboxId)}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sandbox server returned ${res.status}: ${text}`);
    }

    const data = (await res.json()) as CommandResult;
    return { ok: true, data };
  } catch (err) {
    logger.error({ err, sandboxId }, 'Failed to run command in sandbox');
    return { ok: false, error: err instanceof Error ? err.message : 'Command failed' };
  }
}

/**
 * Run a browser task inside a sandbox.
 */
export async function runBrowserTask(
  sandboxId: string,
  url: string,
  instructions: string,
  agentId?: string,
): Promise<VMOperatorResult<BrowserTaskResult>> {
  if (agentId && isBotDesktopPaused(agentId)) {
    return pausedResult<BrowserTaskResult>();
  }

  const baseURL = getSandboxBaseURL();
  if (!baseURL) return notConfigured<BrowserTaskResult>();

  try {
    const res = await fetch(`${baseURL}/sandboxes/${encodeURIComponent(sandboxId)}/browser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, instructions }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sandbox server returned ${res.status}: ${text}`);
    }

    const data = (await res.json()) as BrowserTaskResult;
    return { ok: true, data };
  } catch (err) {
    logger.error({ err, sandboxId }, 'Failed to run browser task in sandbox');
    return { ok: false, error: err instanceof Error ? err.message : 'Browser task failed' };
  }
}

/**
 * Destroy a sandbox and free its resources.
 */
export async function destroySandbox(sandboxId: string): Promise<VMOperatorResult<void>> {
  const baseURL = getSandboxBaseURL();
  if (!baseURL) return notConfigured<void>();

  try {
    const res = await fetch(`${baseURL}/sandboxes/${encodeURIComponent(sandboxId)}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sandbox server returned ${res.status}: ${text}`);
    }

    return { ok: true };
  } catch (err) {
    logger.error({ err, sandboxId }, 'Failed to destroy sandbox');
    return { ok: false, error: err instanceof Error ? err.message : 'Destroy failed' };
  }
}

/**
 * Check whether a sandbox runtime is reachable.
 */
export async function healthCheck(): Promise<VMOperatorResult<{ status: string }>> {
  const baseURL = getSandboxBaseURL();
  if (!baseURL) return notConfigured<{ status: string }>();

  try {
    const res = await fetch(`${baseURL}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return { ok: true, data: await res.json() as { status: string } };
  } catch (err) {
    logger.error({ err }, 'Sandbox health check failed');
    return { ok: false, error: err instanceof Error ? err.message : 'Health check failed' };
  }
}

/**
 * Check whether the desktop for a given bot is currently under human control.
 * The source of truth is the bot's chat session metadata, which is updated by
 * the Desktop view when the user takes over or hands back.
 */
export function isBotDesktopPaused(agentId: string): boolean {
  if (typeof window === 'undefined') return false;
  const sessions = useChatSessionStore.getState().sessions;
  return sessions.some(
    (s) =>
      s.metadata?.agentId === agentId &&
      s.metadata?.vmControlState === 'human_controls',
  );
}

function pausedResult<T>(): VMOperatorResult<T> {
  return {
    ok: false,
    error:
      'Desktop is under human control. The bot will resume autonomous computer use after you hand the desktop back.',
  };
}

export interface BotDesktopStatus {
  status: 'running' | 'off' | 'error';
  control_state: 'bot_controls' | 'human_controls' | 'human_observing';
  ws_url?: string;
  protocol: 'vnc' | 'novnc' | 'none';
  sandbox_id: string;
}

export interface BotDesktopSandbox {
  sandbox_id: string;
  status: string;
  provider: string;
  host?: string;
}

function botDesktopUrl(botId: string, sandboxId: string) {
  return `${API_BASE_URL}/bots/${encodeURIComponent(botId)}/desktop?sandbox_id=${encodeURIComponent(sandboxId)}`;
}

/**
 * Provision a persistent virtual computer for a bot.
 *
 * The sandbox is owned by the bot and survives across chat sessions.
 */
export async function provisionBotDesktop(
  botId: string,
): Promise<VMOperatorResult<BotDesktopSandbox>> {
  try {
    const res = await fetch(`${API_BASE_URL}/bots/${encodeURIComponent(botId)}/desktop/provision`, {
      method: 'POST',
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Platform returned ${res.status}: ${text}`);
    }
    const data = (await res.json()) as BotDesktopSandbox;
    return { ok: true, data };
  } catch (err) {
    logger.error({ err, botId }, 'Failed to provision bot desktop');
    return { ok: false, error: err instanceof Error ? err.message : 'Desktop provisioning failed' };
  }
}

/**
 * Get the desktop status for a bot's persistent sandbox.
 */
export async function getBotDesktopStatus(
  botId: string,
  sandboxId: string,
): Promise<VMOperatorResult<BotDesktopStatus>> {
  try {
    const res = await fetch(botDesktopUrl(botId, sandboxId));
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Platform returned ${res.status}: ${text}`);
    }
    const data = (await res.json()) as BotDesktopStatus;
    return { ok: true, data };
  } catch (err) {
    logger.error({ err, botId, sandboxId }, 'Failed to get bot desktop status');
    return { ok: false, error: err instanceof Error ? err.message : 'Desktop status failed' };
  }
}

/**
 * Human starts observing the bot's desktop without taking control.
 * Bot autonomous actions continue running; the human gets a read-only VNC view.
 */
export async function observeBotDesktop(
  botId: string,
  sandboxId: string,
): Promise<VMOperatorResult<{ control_state: string }>> {
  try {
    const res = await fetch(botDesktopUrl(botId, sandboxId) + '/observe', { method: 'POST' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Platform returned ${res.status}: ${text}`);
    }
    const data = (await res.json()) as { control_state: string };
    return { ok: true, data };
  } catch (err) {
    logger.error({ err, botId, sandboxId }, 'Failed to observe bot desktop');
    return { ok: false, error: err instanceof Error ? err.message : 'Observe failed' };
  }
}

/**
 * Human takes over the bot's desktop. Bot autonomous actions should pause.
 */
export async function takeOverBotDesktop(
  botId: string,
  sandboxId: string,
): Promise<VMOperatorResult<{ control_state: string }>> {
  try {
    const res = await fetch(botDesktopUrl(botId, sandboxId) + '/take-over', { method: 'POST' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Platform returned ${res.status}: ${text}`);
    }
    const data = (await res.json()) as { control_state: string };
    return { ok: true, data };
  } catch (err) {
    logger.error({ err, botId, sandboxId }, 'Failed to take over bot desktop');
    return { ok: false, error: err instanceof Error ? err.message : 'Take over failed' };
  }
}

/**
 * Human hands the desktop back to the bot. Autonomous actions may resume.
 */
export async function handBackBotDesktop(
  botId: string,
  sandboxId: string,
): Promise<VMOperatorResult<{ control_state: string }>> {
  try {
    const res = await fetch(botDesktopUrl(botId, sandboxId) + '/hand-back', { method: 'POST' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Platform returned ${res.status}: ${text}`);
    }
    const data = (await res.json()) as { control_state: string };
    return { ok: true, data };
  } catch (err) {
    logger.error({ err, botId, sandboxId }, 'Failed to hand back bot desktop');
    return { ok: false, error: err instanceof Error ? err.message : 'Hand back failed' };
  }
}

// Re-export unified computer lifecycle helpers so callers can manage the
// provisioned sandbox through the same control plane.
export { deleteComputer } from '@/lib/computers-api';
