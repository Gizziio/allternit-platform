/**
 * VM Operator — Allternit Computer Cloud (Incus / Tart / Lume)
 *
 * Thin client for bot virtual computers. Cloud desktops provision through
 * `/api/v1/computers`, which spawns Incus (Linux/Windows) or Tart (macOS)
 * guests. This is the Firecracker replacement already built in
 * `cmd/allternit-computer-cloud`.
 */

import type { AgentVMOperatorConfig } from '@/lib/agents/agent.types';
import { createModuleLogger } from '@/lib/logger';
import {
  createComputer,
  createComputerSnapshot,
  restoreComputerSnapshot,
  runComputerShell,
  deleteComputer,
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

/** Providers that provision through Allternit Computer Cloud (Incus/Tart/Lume), not Firecracker. */
const UNIFIED_COMPUTER_PROVIDERS = new Set([
  'cloud-desktop',
  'incus',
  'tart',
  'lume',
]);

export function usesUnifiedComputer(
  provider?: AgentVMOperatorConfig['provider'] | string | null,
): boolean {
  if (!provider) return true;
  return UNIFIED_COMPUTER_PROVIDERS.has(provider);
}

function substrateProvider(
  provider?: AgentVMOperatorConfig['provider'] | string | null,
): 'incus' | 'tart' | 'lume' | undefined {
  if (provider === 'incus' || provider === 'tart' || provider === 'lume') return provider;
  return undefined;
}

function notConfigured<T>(): VMOperatorResult<T> {
  return {
    ok: false,
    error:
      'Computer Cloud is not configured. Incus/Tart/Lume provision through /api/v1/computers on allternit-api.',
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
 * Default persistent-desktop resources for bots created through the atomic
 * Create Bot path (spec bot-identity-computer): 2 vCPU / 4 GB RAM / 20 GB disk.
 *
 * These values must stay inside the backend allow-lists (VALIDATED_CPU_CORES /
 * VALIDATED_MEMORY_MB / VALIDATED_DISK_MB in cmd/allternit-api/src/
 * bot_desktop_templates.rs) — the Create Computer step passes them through to
 * POST /api/v1/computers at provision time. The smallest tier is the default
 * on purpose: oversized disk allocations throttle how many bot desktops a
 * host can hold.
 */
export const BOT_DESKTOP_DEFAULT_RESOURCES: NonNullable<
  AgentVMOperatorConfig['resources']
> = {
  cpu: '2',
  memory: '4096',
  disk: '20480',
};

/** Size presets for the Create Bot Computer step (overridable per bot). */
export interface BotDesktopPreset {
  id: 'small' | 'medium' | 'large';
  label: string;
  resources: NonNullable<AgentVMOperatorConfig['resources']>;
}

export const BOT_DESKTOP_PRESETS: BotDesktopPreset[] = [
  {
    id: 'small',
    label: 'Small',
    resources: { cpu: '2', memory: '4096', disk: '20480' },
  },
  {
    id: 'medium',
    label: 'Medium',
    resources: { cpu: '4', memory: '8192', disk: '40960' },
  },
  {
    id: 'large',
    label: 'Large',
    resources: { cpu: '8', memory: '16384', disk: '81920' },
  },
];

export function describeDesktopResources(
  resources?: AgentVMOperatorConfig['resources'],
): string {
  const cpu = resources?.cpu ?? '2';
  const memoryGb = Math.round(Number(resources?.memory ?? '4096') / 1024) || 4;
  const diskGb = Math.round(Number(resources?.disk ?? '20480') / 1024) || 20;
  return `${cpu} vCPU · ${memoryGb} GB RAM · ${diskGb} GB disk`;
}

export function presetIdForResources(
  resources?: AgentVMOperatorConfig['resources'],
): BotDesktopPreset['id'] {
  return BOT_DESKTOP_PRESETS.find(
    (p) =>
      p.resources.cpu === (resources?.cpu ?? '2') &&
      p.resources.memory === (resources?.memory ?? '4096') &&
      p.resources.disk === (resources?.disk ?? '20480'),
  )?.id ?? 'small';
}

/**
 * vmOperator config every new Bot gets by default: a persistent Computer Cloud
 * desktop bound to the bot, provisioned once at create time and reused across
 * sessions. `autoStart: false` keeps session start from booting extra sandboxes
 * — the desktop record already exists from Create Bot.
 */
export function defaultBotVMOperatorConfig(): AgentVMOperatorConfig {
  return {
    enabled: true,
    provider: 'cloud-desktop',
    computerKind: 'cloud_desktop',
    persistence: 'persistent',
    resources: { ...BOT_DESKTOP_DEFAULT_RESOURCES },
    allowedActions: ['command', 'browser', 'file', 'desktop'],
    networkPolicy: 'restricted',
    autoStart: false,
  };
}

export interface EnsureBotComputerOptions {
  /** Bot display name ("Quinn — Chief of Staff") — becomes the computer name. */
  displayName?: string;
}

/**
 * Ensure a bot has exactly one primary persistent Computer Cloud desktop.
 *
 * This is the bind step of the atomic Create Bot contract: list by `bot_id`
 * first and reuse the newest non-deleted desktop (a stopped persistent desktop
 * still binds — it is the same computer), otherwise provision a new one
 * through `/api/v1/computers` with `persistence: 'persistent'`.
 */
export async function ensureBotComputer(
  botId: string,
  config: AgentVMOperatorConfig,
  options?: EnsureBotComputerOptions,
): Promise<VMOperatorResult<Sandbox>> {
  if (!usesUnifiedComputer(config.provider)) {
    return notConfigured<Sandbox>();
  }

  try {
    const computers = await listComputers({
      bot_id: botId,
      kind: config.computerKind ?? 'cloud_desktop',
    });
    const bound = computers
      .filter((c) => c.bot_id === botId && c.status !== 'deleted')
      .sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime(),
      )[0];

    if (bound) {
      return { ok: true, data: mapComputerToSandbox(bound, botId) };
    }

    const response = await createComputer({
      kind: config.computerKind ?? 'cloud_desktop',
      bot_id: botId,
      name: options?.displayName?.trim() || undefined,
      template_id: config.templateId,
      persistence: config.persistence ?? 'persistent',
      provider: substrateProvider(config.provider),
      // Pass the wizard's size preset through so the provisioned desktop
      // actually matches what the user picked. Values come from
      // BOT_DESKTOP_PRESETS, which mirrors the backend allow-lists.
      ...(config.resources?.cpu
        ? { cpu_cores: Number(config.resources.cpu) as 2 | 4 | 8 }
        : {}),
      ...(config.resources?.memory
        ? { memory_mb: Number(config.resources.memory) as 4096 | 8192 | 16384 | 32768 | 65536 }
        : {}),
      ...(config.resources?.disk
        ? { disk_mb: Number(config.resources.disk) as 20480 | 40960 | 81920 }
        : {}),
    });
    return { ok: true, data: mapCreateResponseToSandbox(botId, config, response) };
  } catch (err) {
    logger.error({ err, botId }, 'Failed to ensure bot computer');
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Bot computer provisioning failed',
    };
  }
}

/**
 * Fleet action (spec bot-identity-computer Phase 2): ensure every bot with a
 * VM operator configured has its persistent desktop bound. Runs sequentially
 * on purpose — parallel provisioning would fry the host.
 */
export interface FleetProvisionResult {
  botId: string;
  ok: boolean;
  skipped?: boolean;
  computerId?: string;
  status?: string;
  error?: string;
}

export async function provisionFleetComputers(
  bots: Array<{ id: string; vmOperator?: AgentVMOperatorConfig }>,
  options?: { displayNameFor?: (botId: string) => string | undefined },
): Promise<FleetProvisionResult[]> {
  const results: FleetProvisionResult[] = [];
  for (const bot of bots) {
    if (bot.vmOperator?.enabled !== true) {
      results.push({ botId: bot.id, ok: true, skipped: true });
      continue;
    }
    const result = await ensureBotComputer(bot.id, bot.vmOperator, {
      displayName: options?.displayNameFor?.(bot.id),
    });
    results.push({
      botId: bot.id,
      ok: result.ok,
      computerId: result.data?.id,
      status: result.data?.status,
      error: result.error,
    });
  }
  return results;
}

/**
 * Create a sandbox for the given bot/agent.
 *
 * Provisions through the unified `/api/v1/computers` control plane so cloud
 * desktops are owned by the bot and tracked in the org credit ledger.
 */
async function provisionCloudDesktop(
  botId: string,
  config: AgentVMOperatorConfig,
): Promise<VMOperatorResult<Sandbox>> {
  const provision = await provisionBotDesktop(botId);
  if (!provision.ok || !provision.data) {
    return {
      ok: false,
      error: provision.error ?? 'Cloud desktop provisioning failed',
    };
  }

  const { sandbox_id, provider, status } = provision.data;
  let vncUrl: string | undefined;
  const statusRes = await getBotDesktopStatus(botId, sandbox_id);
  if (statusRes.ok && statusRes.data?.ws_url) {
    vncUrl = statusRes.data.ws_url;
  }

  return {
    ok: true,
    data: {
      id: sandbox_id,
      agentId: botId,
      status: status === 'running' ? 'running' : 'creating',
      provider: provider || 'cloud-desktop',
      vncUrl,
      persistence: config.persistence ?? 'session',
      createdAt: new Date().toISOString(),
    },
  };
}

export async function createSandbox(
  agentId: string,
  config: AgentVMOperatorConfig,
): Promise<VMOperatorResult<Sandbox>> {
  if (!usesUnifiedComputer(config.provider)) {
    return notConfigured<Sandbox>();
  }

  try {
    const response = await createComputer({
      kind: config.computerKind ?? 'cloud_desktop',
      bot_id: agentId,
      template_id: config.templateId,
      persistence: config.persistence,
      provider: substrateProvider(config.provider),
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
  config?: AgentVMOperatorConfig,
): Promise<VMOperatorResult<Sandbox>> {
  if (config && !usesUnifiedComputer(config.provider)) {
    return notConfigured<Sandbox>();
  }

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
 * Uses the unified computer id returned by the lifecycle API.
 */
export async function snapshotSandbox(
  sandboxId: string,
  label?: string,
  agentId?: string,
): Promise<VMOperatorResult<SandboxSnapshot>> {
  try {
    const data = await createComputerSnapshot(sandboxId);
    return {
      ok: true,
      data: {
        id: data.snapshot_id,
        sandboxId,
        label,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    logger.error({ err, sandboxId, agentId }, 'Failed to snapshot sandbox');
    return { ok: false, error: err instanceof Error ? err.message : 'Snapshot failed' };
  }
}

/**
 * Restore a sandbox to a previous snapshot.
 */
export async function restoreSandbox(
  sandboxId: string,
  snapshotId: string,
  agentId?: string,
): Promise<VMOperatorResult<Sandbox>> {
  if (!agentId) return notConfigured<Sandbox>();

  try {
    await restoreComputerSnapshot(sandboxId, snapshotId);
    return {
      ok: true,
      data: {
        id: sandboxId,
        agentId,
        status: 'running',
        provider: 'cloud-desktop',
        createdAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    logger.error({ err, sandboxId, snapshotId, agentId }, 'Failed to restore sandbox');
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
  if (agentId && isBotDesktopPaused(agentId)) {
    return pausedResult<CommandResult>();
  }
  const baseURL = getSandboxBaseURL();
  if (!baseURL) return notConfigured<CommandResult>();

  try {
    const data = await runComputerShell(sandboxId, { command: ['sh', '-c', command] });
    return {
      ok: true,
      data: {
        exitCode: data.exit_code,
        stdout: data.stdout ?? '',
        stderr: data.stderr ?? '',
      },
    };
  } catch (err) {
    logger.error({ err, sandboxId }, 'Failed to run command in sandbox');
    return { ok: false, error: err instanceof Error ? err.message : 'Command failed' };
  }
}

/**
 * Run a browser task inside a sandbox.
 * Computer Cloud has no dedicated browser-task endpoint; use desktop/mouse
 * and desktop/keyboard from the computer pane instead.
 */
export async function runBrowserTask(
  _sandboxId: string,
  _url: string,
  _instructions: string,
  agentId?: string,
): Promise<VMOperatorResult<BrowserTaskResult>> {
  if (agentId && isBotDesktopPaused(agentId)) {
    return pausedResult<BrowserTaskResult>();
  }
  return notConfigured<BrowserTaskResult>();
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
  try {
    await deleteComputer(sandboxId);
    return { ok: true };
  } catch (err) {
    logger.error({ err, sandboxId }, 'Failed to destroy sandbox');
    return { ok: false, error: err instanceof Error ? err.message : 'Destroy failed' };
  }
}

/**
 * Check whether the Computer Cloud control plane is reachable.
 */
export async function healthCheck(): Promise<VMOperatorResult<{ status: string }>> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return { ok: true, data: (await res.json()) as { status: string } };
  } catch (err) {
    logger.error({ err }, 'Computer Cloud health check failed');
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
  status: 'creating' | 'running' | 'stopped' | 'off' | 'error';
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

function botDesktopUrl(botId: string, sandboxId: string, action = '') {
  // The action goes in the PATH, before the query string — appending it
  // after `?sandbox_id=…` lands on the GET-only /desktop route (405).
  return `${API_BASE_URL}/bots/${encodeURIComponent(botId)}/desktop${action}?sandbox_id=${encodeURIComponent(sandboxId)}`;
function botDesktopBaseUrl(botId: string) {
  return `${API_BASE_URL}/bots/${encodeURIComponent(botId)}/desktop`;
}

function botDesktopUrl(botId: string, sandboxId: string) {
  return `${botDesktopBaseUrl(botId)}?sandbox_id=${encodeURIComponent(sandboxId)}`;
}

function botDesktopActionUrl(botId: string, sandboxId: string, action: string) {
  return `${botDesktopBaseUrl(botId)}/${action}?sandbox_id=${encodeURIComponent(sandboxId)}`;
}

// Control actions are path segments on the server (`POST …/desktop/observe`
// etc., bot_desktop_routes.rs), with sandbox_id as a query param — appending
// the verb after the query string would land it inside the sandbox_id value.
function botDesktopActionUrl(botId: string, sandboxId: string, action: 'observe' | 'take-over' | 'hand-back') {
  return `${API_BASE_URL}/bots/${encodeURIComponent(botId)}/desktop/${action}?sandbox_id=${encodeURIComponent(sandboxId)}`;
}

function botDesktopBindingUrl(botId: string) {
  return `${API_BASE_URL}/bots/${encodeURIComponent(botId)}/desktop`;
}

/**
 * Read the bot's persisted desktop mapping (`bot_desktop_sandboxes`).
 * The account owns one Incus/Tart computer; bots attach to it as screens.
 * `GET /api/v1/computers?bot_id=` is empty for that shared computer
 * (`bot_id` is null on the row) — this endpoint is the source of truth.
 */
export async function getBotDesktopBinding(
  botId: string,
  signal?: AbortSignal,
): Promise<VMOperatorResult<BotDesktopStatus>> {
  try {
    const res = await fetch(botDesktopBindingUrl(botId), { signal });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Platform returned ${res.status}: ${text}`);
    }
    const data = (await res.json()) as BotDesktopStatus;
    if (!data?.sandbox_id) {
      return { ok: false, error: 'Bot has no desktop sandbox' };
    }
    return { ok: true, data };
  } catch (err) {
    logger.error({ err, botId }, 'Failed to get bot desktop binding');
    return { ok: false, error: err instanceof Error ? err.message : 'Desktop binding failed' };
  }
}

/**
 * Resolve the computer a bot chat/window should show.
 *
 * Order: persisted bot mapping → attach to the running account computer
 * (provision is idempotent attach when a user computer already exists) →
 * computers API filtered by bot_id.
 */
export async function resolveLiveBotDesktop(
  botId: string,
  hintSandboxId?: string | null,
): Promise<VMOperatorResult<BotActiveVmLike>> {
  if (hintSandboxId) {
    const hinted = await getBotDesktopStatus(botId, hintSandboxId);
    if (hinted.ok && hinted.data && isLiveDesktopStatus(hinted.data.status)) {
      return { ok: true, data: vmFromDesktopStatus(hinted.data) };
    }
  }

  const binding = await getBotDesktopBinding(botId);
  if (binding.ok && binding.data && isLiveDesktopStatus(binding.data.status)) {
    return { ok: true, data: vmFromDesktopStatus(binding.data) };
  }

  try {
    const computers = await listComputers({ kind: 'cloud_desktop' });
    const live = computers.find(
      (c) => c.status === 'running' || c.status === 'creating',
    );
    if (live) {
      const attached = await provisionBotDesktop(botId);
      if (attached.ok && attached.data?.sandbox_id) {
        return {
          ok: true,
          data: {
            id: attached.data.sandbox_id,
            provider: attached.data.provider,
            status: attached.data.status,
          },
        };
      }
    }
  } catch (err) {
    logger.error({ err, botId }, 'Failed to attach bot to account computer');
  }

  const byBot = await getSandboxForAgent(botId);
  if (byBot.ok && byBot.data) {
    return {
      ok: true,
      data: {
        id: byBot.data.id,
        provider: byBot.data.provider,
        status: byBot.data.status,
        vncUrl: byBot.data.vncUrl,
      },
    };
  }

  return { ok: false, error: byBot.error ?? binding.error ?? 'No live desktop' };
}

function isLiveDesktopStatus(status?: string): boolean {
  return status === 'running' || status === 'creating';
}

function vmFromDesktopStatus(data: BotDesktopStatus): BotActiveVmLike {
  return {
    id: data.sandbox_id,
    provider: data.provider ?? 'cloud-desktop',
    status: data.status,
    vncUrl: data.ws_url,
  };
}

export type BotActiveVmLike = {
  id: string;
  provider: string;
  status: string;
  vncUrl?: string;
};

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
    const res = await fetch(botDesktopUrl(botId, sandboxId, '/observe'), { method: 'POST' });
    const res = await fetch(botDesktopActionUrl(botId, sandboxId, 'observe'), { method: 'POST' });
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
    const res = await fetch(botDesktopUrl(botId, sandboxId, '/take-over'), { method: 'POST' });
    const res = await fetch(botDesktopActionUrl(botId, sandboxId, 'take-over'), { method: 'POST' });
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
    const res = await fetch(botDesktopUrl(botId, sandboxId, '/hand-back'), { method: 'POST' });
    const res = await fetch(botDesktopActionUrl(botId, sandboxId, 'hand-back'), { method: 'POST' });
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
    const res = await fetch(botDesktopUrl(botId, sandboxId, '/start'), { method: 'POST' });
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
    const res = await fetch(botDesktopUrl(botId, sandboxId, '/stop'), { method: 'POST' });
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
    const res = await fetch(botDesktopUrl(botId, sandboxId, '/pause'), { method: 'POST' });
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
    const res = await fetch(botDesktopUrl(botId, sandboxId, '/resume'), { method: 'POST' });
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
 * Capture a screenshot of the bot's desktop via guest exec (scrot / PowerShell).
 */
export async function getBotDesktopScreenshot(
  botId: string,
  sandboxId: string,
  signal?: AbortSignal,
): Promise<VMOperatorResult<BotDesktopScreenshot>> {
  try {
    const res = await fetch(botDesktopUrl(botId, sandboxId, '/screenshot'), {
      method: 'GET',
      headers: { Accept: 'image/png, application/json' },
      signal,
    });
    if (res.status === 204 || res.status === 404) {
      return { ok: false, error: 'Screenshots are not available for this desktop provider' };
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Platform returned ${res.status}: ${text}`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as BotDesktopScreenshot;
      return { ok: true, data };
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return { ok: true, data: { png: btoa(binary), mime: 'image/png' } };
  } catch (err) {
    logger.error({ err, botId, sandboxId }, 'Failed to capture bot desktop screenshot');
    return { ok: false, error: err instanceof Error ? err.message : 'Screenshot failed' };
  }
}

export { deleteComputer };
 * Build the screenshot URL for a bot's desktop. The returned URL returns an
 * image (SVG placeholder when no live VM stream is available) that can be
 * polled to implement a screenshot feed.
 */
export function getBotDesktopScreenshotUrl(botId: string, sandboxId: string, cacheBust?: number): string {
  const url = botDesktopActionUrl(botId, sandboxId, 'screenshot');
  if (cacheBust === undefined) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}ts=${cacheBust}`;
}
