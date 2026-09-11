/**
 * Start Bot Session — plain (non-hook) session-start core.
 *
 * Extracted from useStartBotSession so non-React callers (rail rows, toasts,
 * launchpad, bot home) can start or reuse a bot's canonical chat session and
 * land it in the standard in-chat surface without mounting the hook.
 *
 * @module start-bot-session
 */

import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { resolveAgentSecrets } from '@/lib/agents/agent-secrets-resolver';
import { resolveAgentConnectors } from '@/lib/agents/agent-connectors-resolver';
import { useAgentStore } from '@/lib/agents/agent.store';
import { createAgent, getAgent, updateAgent } from '../agents/agent.service';
import type { Agent, CreateAgentInput } from '../agents/agent.types';
import { nativeSessionsApi } from '../agents/native-sessions-api';
import {
  resolveAgentBrain,
  resumeOrCreateBotBrain,
} from './bot-brain';
import {
  createSandbox,
  getSandboxForAgent,
  isBotDesktopPaused,
  type Sandbox,
} from './vm-operator';
import { useBotAllternitBusStore } from './bot-allternit-bus';
import { useBotRosterStore } from './bot-roster.store';
import { isBot } from './bot-profile';
import {
  computeCapabilityEpoch,
  capabilityEpochLine,
  hasEpochDrifted,
  type CapabilityRosterEntry,
} from './bot-capability-epoch';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('StartBotSession');

export interface BotSessionStartResult {
  sessionId: string;
  sandbox?: Sandbox;
  sandboxError?: string;
  notice?: string;
  nativeSessionId?: string;
}

function buildVMSystemPrompt(vmConfig: NonNullable<Agent['vmOperator']>, sandbox?: Sandbox): string {
  const lines = [
    '## Virtual Computer Operator',
    '',
    `You have access to a sandboxed virtual computer (${vmConfig.provider}).`,
    `Allowed actions: ${(vmConfig.allowedActions?.length ? vmConfig.allowedActions : ['command']).join(', ')}.`,
    `Network policy: ${vmConfig.networkPolicy || 'restricted'}.`,
    `Persistence: ${vmConfig.persistence || 'session'}.`,
  ];

  if (sandbox) {
    lines.push(
      '',
      `A sandbox is already running for this session (id: ${sandbox.id}).`,
      sandbox.vncUrl ? `VNC stream: ${sandbox.vncUrl}` : '',
      'Use the sandbox to run commands, operate browsers, edit files, or stream the desktop when the user asks you to perform actions that require a computer.'
    );
  } else {
    lines.push(
      '',
      'A sandbox will be started automatically when you request a computer-use action.',
      'When the user asks you to perform actions that require a computer, ask for permission if the trust tier requires it, then use the sandbox tools available to you.'
    );
  }

  return lines.filter(Boolean).join('\n');
}

function buildIdentityPrompt(displayName: string, capabilityEpoch: string): string {
  return (
    `You are ${displayName}. You must ALWAYS identify yourself as ${displayName}. ` +
    `NEVER say you are Kimi, GPT, Claude, an AI assistant created by another company, or any name other than ${displayName}.\n` +
    capabilityEpochLine(capabilityEpoch)
  );
}

export function resolveBotRuntimeModelId(agent: Agent, modelOverride?: string): string | undefined {
  if (modelOverride) return modelOverride;
  const config = (agent.config ?? {}) as Record<string, unknown>;
  if (typeof config.runtimeModelId === 'string' && config.runtimeModelId) {
    return config.runtimeModelId;
  }
  if (agent.provider && agent.model) {
    return `${agent.provider}/${agent.model}`;
  }
  return undefined;
}

/**
 * Best-effort: make sure the API's agents table knows about this bot before
 * createSession runs the surface gate. Bots created while the API was down
 * live only in the localStorage fallback registry, and the gate
 * (403 agent_not_allowed_on_surface) rejects sessions for agents the API
 * has never seen. The client-stable id is preserved so the API row matches
 * the id the renderer uses for the session. Returns false when registration
 * failed (offline or validation error) — never blocks the local fallback,
 * but the failure is logged so it stops being silent.
 */
export async function ensureBotRegisteredWithApi(agent: Agent): Promise<boolean> {
  try {
    const registered = await getAgent(agent.id);
    const isPlaceholder =
      registered.name === 'Unknown Agent' && !registered.systemPrompt;
    if (!isPlaceholder) return true;
    const input: CreateAgentInput = {
      id: agent.id,
      name: agent.name,
      description: agent.description ?? '',
      type: agent.type,
      model: agent.model,
      provider: agent.provider,
      systemPrompt: agent.systemPrompt,
      avatar: agent.avatar,
      isBot: true,
      botProfile: agent.botProfile,
      allowedSurfaces: ['chat'],
      tags: agent.tags,
      category: agent.category,
      trustTier: agent.trustTier,
    };
    await createAgent(input);
    logger.info({ botId: agent.id }, 'Registered bot with API ahead of session create');
    return true;
  } catch (err) {
    logger.warn(
      { err, botId: agent.id, botName: agent.name },
      'Bot registration with API failed; session will use the local fallback',
    );
    return false;
  }
}

/**
 * Prepare (create or reuse) a bot's canonical chat session. Pure store/API
 * work — no React state. Does NOT set the active session; callers decide.
 */
async function bindExecutionBrain(agent: Agent): Promise<Agent> {
  const current = resolveAgentBrain(agent);
  if (current.mode === 'allternit_cloud') {
    return { ...agent, brain: current };
  }

  const bound = await resumeOrCreateBotBrain(current, agent.id, nativeSessionsApi);
  if (
    bound.nativeSessionId !== current.nativeSessionId ||
    bound.uhpHarnessId !== current.uhpHarnessId
  ) {
    try {
      await updateAgent(agent.id, { brain: bound });
    } catch (err) {
      logger.warn({ err, botId: agent.id }, 'Persisting bot.brain after native bind failed');
    }
  }
  return { ...agent, brain: bound };
}

export async function prepareBotSession(
  agent: Agent,
  options?: { modeId?: string; modelOverride?: string },
): Promise<BotSessionStartResult | null> {
  const displayName = agent.botProfile?.displayName ?? agent.name;
  const store = useChatSessionStore.getState();
  const runtimeModelId = resolveBotRuntimeModelId(agent, options?.modelOverride);

  const boundAgent = await bindExecutionBrain(agent);
  const brain = resolveAgentBrain(boundAgent);
  const nativeSessionId = brain.mode === 'native_harness' ? brain.nativeSessionId : undefined;

  // Capability epoch (spec AD-4): fingerprint the bot's whole capability
  // surface so persona/skill edits are never stranded in a stale session.
  const rosterBots: CapabilityRosterEntry[] = useAgentStore
    .getState()
    .agents.filter(isBot)
    .map((a) => ({ name: a.name, handle: a.botProfile?.handle ?? a.name }));
  const capabilityEpoch = computeCapabilityEpoch(agent, rosterBots);

  // Each bot has one persistent chat session. Reuse the latest existing
  // session for this bot instead of creating a new one every time the user
  // clicks the bot in the rail. Locally-created `temp-…` sessions qualify
  // too — the metadata match is what makes it canonical, not the id shape.
  const existingSession = store.sessions.find(
    (s) =>
      s.metadata?.isBot === true &&
      (s.metadata?.agentId === agent.id || s.metadata?.agentName === agent.name),
  );
  if (existingSession) {
    // Rebuild-once-per-drift: if the stored epoch differs from the freshly
    // computed one, refresh the identity/system-prompt injection so edits
    // to the bot's persona/skills reach the reused session. The rest of the
    // session content (messages, metadata) is left untouched.
    const storedEpoch = existingSession.metadata?.capabilityEpoch;
    if (hasEpochDrifted(storedEpoch, capabilityEpoch)) {
      const basePrompt = agent.systemPrompt ?? '';
      const identityPrompt = buildIdentityPrompt(displayName, capabilityEpoch);
      const notice =
        typeof existingSession.metadata?.vmControlNotice === 'string'
          ? existingSession.metadata.vmControlNotice
          : undefined;
      const systemPrompt = [identityPrompt, basePrompt, notice].filter(Boolean).join('\n\n');
      await store.updateSession(existingSession.id, {
        metadata: {
          ...existingSession.metadata,
          capabilityEpoch,
          systemPrompt,
          botProfile: agent.botProfile,
          starterPrompts: agent.botProfile?.starterPrompts,
        },
      });
    }
    // Persistent computer (spec bot-identity-computer): reopening a bot
    // must land on the same desktop that Create Bot provisioned — resolve
    // by bot_id and refresh the session's computer reference. Never create
    // here; provisioning is part of the atomic create, and autoStart stays
    // off so opening a session never boots a replacement sandbox.
    if (agent.vmOperator?.enabled === true && !isBotDesktopPaused(agent.id)) {
      try {
        const bound = await getSandboxForAgent(agent.id, agent.vmOperator);
        if (
          bound.ok &&
          bound.data &&
          bound.data.id !== existingSession.metadata?.vmComputerId
        ) {
          await store.updateSession(existingSession.id, {
            metadata: {
              ...existingSession.metadata,
              vmSandbox: {
                id: bound.data.id,
                provider: bound.data.provider,
                status: bound.data.status,
                vncUrl: bound.data.vncUrl,
              },
              vmComputerId: bound.data.id,
              vmOperator: agent.vmOperator,
            },
          });
        }
      } catch {
        // Non-fatal: the session opens without a refreshed computer reference.
      }
    }
    useBotRosterStore.getState().setCanonicalChatId(agent.id, existingSession.id);
    if (nativeSessionId && existingSession.metadata?.agent_session !== nativeSessionId) {
      await store.updateSession(existingSession.id, {
        metadata: {
          ...existingSession.metadata,
          agent_session: nativeSessionId,
          botBrain: brain,
        },
      });
    }
    return { sessionId: existingSession.id, nativeSessionId };
  }

  const [secretsResult, connectorsResult] = await Promise.all([
    resolveAgentSecrets(agent.id, agent.secretRefs),
    resolveAgentConnectors(agent.id, agent.connectorBindings),
  ]);

  let sandbox: Sandbox | undefined;
  let sandboxError: string | undefined;
  let notice: string | undefined;
  const vmConfig = agent.vmOperator;
  const isDesktopPaused = isBotDesktopPaused(agent.id);
  // Resolve the bot's persistent desktop whenever a VM operator is
  // configured. Creating a replacement sandbox is gated on autoStart: bots
  // created through the atomic Create Bot path already have a desktop bound
  // via bot_id (autoStart stays off so opening a session never boots a new
  // one), while older agents with autoStart unset keep get-or-create.
  const shouldResolveSandbox = vmConfig?.enabled === true && !isDesktopPaused;

  if (isDesktopPaused) {
    notice =
      'Desktop is under human control. The bot will resume autonomous computer use after you hand the desktop back.';
  }

  if (shouldResolveSandbox) {
    // Prefer the bot's existing persistent computer so state (toolchain,
    // files, browser sessions) survives across sessions. Only create a new
    // sandbox if none exists yet and the config allows auto-start.
    const existing = await getSandboxForAgent(agent.id, vmConfig);
    if (existing.ok && existing.data) {
      sandbox = existing.data;
    } else if (vmConfig.autoStart !== false) {
      const result = await createSandbox(agent.id, vmConfig);
      if (result.ok && result.data) {
        sandbox = result.data;
      } else {
        sandboxError = result.error ?? 'Virtual computer failed to start';
      }
    }
  }

  const vmPrompt = vmConfig?.enabled ? buildVMSystemPrompt(vmConfig, sandbox) : '';

  // Connect AllternitBus cloud-orchestration messaging when configured
  const allternitBusEnabled = agent.messagingConfig?.photonEnabled === true;
  if (allternitBusEnabled) {
    useBotAllternitBusStore.getState().connect(agent.id);
  }

  const basePrompt = agent.systemPrompt ?? '';
  const identityPrompt = buildIdentityPrompt(displayName, capabilityEpoch);
  const systemPrompt = [identityPrompt, basePrompt, vmPrompt, notice].filter(Boolean).join('\n\n');

  await ensureBotRegisteredWithApi(agent);

  const sessionId = await store.createSession({
    name: displayName,
    description: agent.botProfile?.welcomeMessage ?? agent.description,
    sessionMode: 'agent',
    agentId: agent.id,
    agentName: displayName,
    systemPrompt,
    metadata: {
      isBot: true,
      botCanonicalFor: agent.id,
      botProfile: agent.botProfile,
      starterPrompts: agent.botProfile?.starterPrompts,
      capabilityEpoch,
      model: agent.model,
      runtimeModelId,
      tags: agent.tags,
      category: agent.category,
      trustTier: agent.trustTier,
      agentModeId: options?.modeId,
      originSurface: 'chat',
      connectorBindings: agent.connectorBindings,
      secretRefs: agent.secretRefs,
      resolvedSecrets: secretsResult.secrets,
      missingSecrets: secretsResult.missing,
      resolvedConnectors: connectorsResult.credentials,
      missingConnectors: connectorsResult.missing,
      messagingConfig: agent.messagingConfig,
      identityChannels: agent.identityChannels,
      vmOperator: agent.vmOperator,
      vmSandbox: sandbox ? { id: sandbox.id, provider: sandbox.provider, status: sandbox.status, vncUrl: sandbox.vncUrl } : undefined,
      vmComputerId: sandbox?.id,
      vmSandboxError: sandboxError,
      vmControlNotice: notice,
      botBrain: brain,
      agent_session: nativeSessionId,
    },
  });

  useBotRosterStore.getState().setCanonicalChatId(agent.id, sessionId);
  return { sessionId, sandbox, sandboxError, notice, nativeSessionId };
}
