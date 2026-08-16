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
import { createModuleLogger } from '@/lib/logger';

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

/**
 * Create a sandbox for the given bot/agent.
 *
 * In a production deployment this calls POST /sandboxes on the configured
 * sandbox server. Until then it returns a deterministic "not configured"
 * result.
 */
export async function createSandbox(
  agentId: string,
  config: AgentVMOperatorConfig,
): Promise<VMOperatorResult<Sandbox>> {
  const baseURL = getSandboxBaseURL();
  if (!baseURL) {
    logger.debug({ agentId }, 'Sandbox runtime not configured; skipping createSandbox');
    return notConfigured<Sandbox>();
  }

  try {
    const res = await fetch(`${baseURL}/sandboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentId,
        provider: config.provider,
        image: config.image,
        resources: config.resources,
        network_policy: config.networkPolicy,
        persistence: config.persistence,
        timeout_minutes: config.timeoutMinutes,
        vnc_enabled: config.vncEnabled,
        env: config.env,
        command: config.command,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sandbox server returned ${res.status}: ${text}`);
    }

    const data = (await res.json()) as Sandbox;
    return { ok: true, data };
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
  const baseURL = getSandboxBaseURL();
  if (!baseURL) {
    logger.debug({ agentId }, 'Sandbox runtime not configured; skipping getSandboxForAgent');
    return notConfigured<Sandbox>();
  }

  try {
    const res = await fetch(
      `${baseURL}/sandboxes?agent_id=${encodeURIComponent(agentId)}`,
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sandbox server returned ${res.status}: ${text}`);
    }

    const list = (await res.json()) as Sandbox[];
    const active = list
      .filter((s) => s.agentId === agentId && (s.status === 'running' || s.status === 'creating'))
      .sort(
        (a, b) =>
          new Date(b.lastActiveAt || b.createdAt).getTime() -
          new Date(a.lastActiveAt || a.createdAt).getTime(),
      )[0];

    if (!active) {
      return { ok: false, error: `No active sandbox found for agent ${agentId}` };
    }

    return { ok: true, data: active };
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
): Promise<VMOperatorResult<CommandResult>> {
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
): Promise<VMOperatorResult<BrowserTaskResult>> {
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
