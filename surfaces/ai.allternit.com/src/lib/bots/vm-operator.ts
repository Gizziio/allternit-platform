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
  status: 'running' | 'stopped' | 'off' | 'error';
  control_state: 'bot_controls' | 'human_controls' | 'human_observing';
  ws_url?: string;
  protocol: 'vnc' | 'novnc' | 'none';
  sandbox_id: string;
  provider?: string;
  host?: string;
  viewer_url?: string;
  last_error?: string;
}

export interface BotDesktopScreenshot {
  png: string;
  mime: string;
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
  signal?: AbortSignal,
): Promise<VMOperatorResult<BotDesktopStatus>> {
  try {
    const res = await fetch(botDesktopUrl(botId, sandboxId), { signal });
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

/**
 * Start a stopped bot desktop sandbox.
 */
export async function startBotDesktop(
  botId: string,
  sandboxId: string,
): Promise<VMOperatorResult<{ status: string }>> {
  try {
    const res = await fetch(botDesktopUrl(botId, sandboxId) + '/start', { method: 'POST' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Platform returned ${res.status}: ${text}`);
    }
    const data = (await res.json()) as { status: string };
    return { ok: true, data };
  } catch (err) {
    logger.error({ err, botId, sandboxId }, 'Failed to start bot desktop');
    return { ok: false, error: err instanceof Error ? err.message : 'Start failed' };
  }
}

/**
 * Stop a running bot desktop sandbox.
 */
export async function stopBotDesktop(
  botId: string,
  sandboxId: string,
): Promise<VMOperatorResult<{ status: string }>> {
  try {
    const res = await fetch(botDesktopUrl(botId, sandboxId) + '/stop', { method: 'POST' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Platform returned ${res.status}: ${text}`);
    }
    const data = (await res.json()) as { status: string };
    return { ok: true, data };
  } catch (err) {
    logger.error({ err, botId, sandboxId }, 'Failed to stop bot desktop');
    return { ok: false, error: err instanceof Error ? err.message : 'Stop failed' };
  }
}

/**
 * Pause a running bot desktop sandbox.
 */
export async function pauseBotDesktop(
  botId: string,
  sandboxId: string,
): Promise<VMOperatorResult<{ status: string }>> {
  try {
    const res = await fetch(botDesktopUrl(botId, sandboxId) + '/pause', { method: 'POST' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Platform returned ${res.status}: ${text}`);
    }
    const data = (await res.json()) as { status: string };
    return { ok: true, data };
  } catch (err) {
    logger.error({ err, botId, sandboxId }, 'Failed to pause bot desktop');
    return { ok: false, error: err instanceof Error ? err.message : 'Pause failed' };
  }
}

/**
 * Resume a paused bot desktop sandbox.
 */
export async function resumeBotDesktop(
  botId: string,
  sandboxId: string,
): Promise<VMOperatorResult<{ status: string }>> {
  try {
    const res = await fetch(botDesktopUrl(botId, sandboxId) + '/resume', { method: 'POST' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Platform returned ${res.status}: ${text}`);
    }
    const data = (await res.json()) as { status: string };
    return { ok: true, data };
  } catch (err) {
    logger.error({ err, botId, sandboxId }, 'Failed to resume bot desktop');
    return { ok: false, error: err instanceof Error ? err.message : 'Resume failed' };
  }
}

/**
 * Destroy a bot desktop sandbox and free its resources.
 */
export async function destroyBotDesktop(
  botId: string,
  sandboxId: string,
): Promise<VMOperatorResult<void>> {
  try {
    const res = await fetch(botDesktopUrl(botId, sandboxId), { method: 'DELETE' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Platform returned ${res.status}: ${text}`);
    }
    return { ok: true };
  } catch (err) {
    logger.error({ err, botId, sandboxId }, 'Failed to destroy bot desktop');
    return { ok: false, error: err instanceof Error ? err.message : 'Destroy failed' };
  }
}

/**
 * Capture a screenshot of the bot's desktop.
 *
 * Returns a base64 PNG when the sandbox runtime supports it; otherwise the
 * platform returns a clear 204/empty response and the UI shows a placeholder.
 */
export async function getBotDesktopScreenshot(
  botId: string,
  sandboxId: string,
  signal?: AbortSignal,
): Promise<VMOperatorResult<BotDesktopScreenshot>> {
  try {
    const res = await fetch(botDesktopUrl(botId, sandboxId) + '/screenshot', { method: 'POST', signal });
    if (res.status === 204 || res.status === 404) {
      return { ok: false, error: 'Screenshots are not available for this desktop provider' };
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Platform returned ${res.status}: ${text}`);
    }
    const data = (await res.json()) as BotDesktopScreenshot;
    return { ok: true, data };
  } catch (err) {
    logger.error({ err, botId, sandboxId }, 'Failed to capture bot desktop screenshot');
    return { ok: false, error: err instanceof Error ? err.message : 'Screenshot failed' };
  }
}
