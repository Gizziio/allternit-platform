/**
 * Bot Agents BA-3 execution-brain bind.
 *
 * `bot.brain` is how a Bot runs (native Codex/Claude/Kimi session, Allternit
 * cloud, or UHP harness). It is not `brainId` (Gizzi `/api/v1/brains`).
 *
 * Join key: `brain.nativeSessionId` ↔ native catalog / `AgentInfo.agent_session`.
 * Native start never silently falls back to a different brain.
 */

import type {
  Agent,
  BotBrainBinding,
  BotBrainMode,
  BotBrainModelRef,
} from '@/lib/agents/agent.types';
import { botBrainSchema } from '@/lib/agents/agent.types';
import type {
  NativeCatalogSession,
  NativeHarnessInfo,
  PickupResult,
} from '@/lib/agents/native-sessions-api';

export const BOT_BRAIN_MODES: readonly BotBrainMode[] = [
  'allternit_cloud',
  'native_harness',
  'uhp_harness',
] as const;

export const NATIVE_HARNESS_IDS = ['codex', 'claude', 'kimi'] as const;
export type NativeHarnessId = (typeof NATIVE_HARNESS_IDS)[number];

export const BOT_BRAIN_MODE_LABEL: Record<BotBrainMode, string> = {
  allternit_cloud: 'Allternit cloud',
  native_harness: 'Native harness',
  uhp_harness: 'UHP harness',
};

export const NATIVE_HARNESS_LABEL: Record<NativeHarnessId, string> = {
  codex: 'Codex',
  claude: 'Claude',
  kimi: 'Kimi',
};

export type BotBrainBindErrorCode =
  | 'harness_missing'
  | 'session_missing'
  | 'uhp_missing'
  | 'invalid';

export class BotBrainBindError extends Error {
  readonly code: BotBrainBindErrorCode;

  constructor(message: string, code: BotBrainBindErrorCode) {
    super(message);
    this.name = 'BotBrainBindError';
    this.code = code;
  }
}

export interface NativeSessionsPort {
  listHarnesses: () => Promise<NativeHarnessInfo[]>;
  list: (opts?: { harness?: string }) => Promise<NativeCatalogSession[]>;
  pickup: (input: {
    harness: string;
    sessionId: string;
    surface?: 'bot';
  }) => Promise<PickupResult>;
  spawn?: (input: {
    harness: string;
    sessionId?: string;
  }) => Promise<{ harness: string; sessionId: string; spawned: boolean }>;
}

export interface UhpPort {
  spawn: (harnessId: string) => Promise<{ sessionId?: string }>;
}

export function defaultBotBrain(modelRef?: BotBrainModelRef): BotBrainBinding {
  return {
    mode: 'allternit_cloud',
    ...(modelRef ? { modelRef } : {}),
  };
}

export function parseBotBrain(raw: unknown): BotBrainBinding | undefined {
  if (raw == null) return undefined;
  const parsed = botBrainSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  return parsed.data;
}

/** Resolve brain from the dedicated field or config fallback (`botBrain`). */
export function resolveAgentBrain(agent: Pick<Agent, 'brain' | 'config'>): BotBrainBinding {
  const fromField = parseBotBrain(agent.brain);
  if (fromField) return fromField;
  const fromConfig = parseBotBrain(
    agent.config && typeof agent.config === 'object'
      ? (agent.config as Record<string, unknown>).botBrain
      : undefined,
  );
  if (fromConfig) return fromConfig;
  return defaultBotBrain();
}

export function nativeHarnessLabel(harness: string | undefined): string {
  if (!harness) return 'Native harness';
  if (harness in NATIVE_HARNESS_LABEL) {
    return NATIVE_HARNESS_LABEL[harness as NativeHarnessId];
  }
  return harness;
}

/** Hub / roster chip. Never uses Gizzi `brainId`. */
export function botBrainLabel(brain: BotBrainBinding | undefined): string {
  const bound = brain ?? defaultBotBrain();
  if (bound.mode === 'native_harness') {
    return nativeHarnessLabel(bound.harness);
  }
  if (bound.mode === 'uhp_harness') {
    return bound.uhpHarnessId ? `UHP · ${bound.uhpHarnessId}` : BOT_BRAIN_MODE_LABEL.uhp_harness;
  }
  if (bound.modelRef?.modelID) {
    return `${BOT_BRAIN_MODE_LABEL.allternit_cloud} · ${bound.modelRef.modelID}`;
  }
  return BOT_BRAIN_MODE_LABEL.allternit_cloud;
}

export function modelRefFromAgent(agent: Pick<Agent, 'provider' | 'model'>): BotBrainModelRef | undefined {
  if (!agent.provider || !agent.model) return undefined;
  return { providerID: agent.provider, modelID: agent.model };
}

export function normalizeBotBrain(
  brain: Partial<BotBrainBinding> | undefined,
  modelRef?: BotBrainModelRef,
): BotBrainBinding {
  const mode = brain?.mode && BOT_BRAIN_MODES.includes(brain.mode)
    ? brain.mode
    : 'allternit_cloud';

  if (mode === 'native_harness') {
    const harness = brain?.harness?.trim() || 'codex';
    return {
      mode,
      harness,
      ...(brain?.nativeSessionId?.trim()
        ? { nativeSessionId: brain.nativeSessionId.trim() }
        : {}),
      ...(modelRef ? { modelRef } : brain?.modelRef ? { modelRef: brain.modelRef } : {}),
    };
  }

  if (mode === 'uhp_harness') {
    return {
      mode,
      ...(brain?.uhpHarnessId?.trim() ? { uhpHarnessId: brain.uhpHarnessId.trim() } : {}),
      ...(modelRef ? { modelRef } : brain?.modelRef ? { modelRef: brain.modelRef } : {}),
    };
  }

  return {
    mode: 'allternit_cloud',
    ...(modelRef ? { modelRef } : brain?.modelRef ? { modelRef: brain.modelRef } : {}),
  };
}

/**
 * Resume or create a tracked native/UHP brain. Never swaps to another mode.
 *
 * `native_harness` with a stored `nativeSessionId` pickups that session only.
 * Without one, creates a tracked id `bot-<botId>-<harness>` and pickups it
 * (or the first catalog session of that harness if pickup of the tracked id
 * fails and the catalog has exactly one session — still the same harness).
 */
export async function resumeOrCreateBotBrain(
  brain: BotBrainBinding,
  botId: string,
  ports: NativeSessionsPort,
  uhp?: UhpPort,
): Promise<BotBrainBinding> {
  if (brain.mode === 'allternit_cloud') {
    return brain;
  }

  if (brain.mode === 'uhp_harness') {
    if (!brain.uhpHarnessId?.trim()) {
      throw new BotBrainBindError(
        'UHP harness id is required. This bot will not switch to Allternit cloud.',
        'uhp_missing',
      );
    }
    if (!uhp) {
      throw new BotBrainBindError(
        'UHP spawn is not wired. This bot will not switch to Allternit cloud.',
        'uhp_missing',
      );
    }
    try {
      const spawned = await uhp.spawn(brain.uhpHarnessId.trim());
      return {
        ...brain,
        nativeSessionId: spawned.sessionId || brain.nativeSessionId,
      };
    } catch {
      throw new BotBrainBindError(
        `Could not spawn UHP harness ${brain.uhpHarnessId}. This bot will not switch to Allternit cloud.`,
        'uhp_missing',
      );
    }
  }

  const harness = brain.harness?.trim();
  if (!harness) {
    throw new BotBrainBindError(
      'Native harness is required. This bot will not switch to Allternit cloud.',
      'invalid',
    );
  }

  let harnesses: NativeHarnessInfo[];
  try {
    harnesses = await ports.listHarnesses();
  } catch {
    throw new BotBrainBindError(
      `${nativeHarnessLabel(harness)} catalog is unreachable. This bot will not switch to Allternit cloud.`,
      'harness_missing',
    );
  }

  const info = harnesses.find((h) => h.id === harness);
  if (!info?.present) {
    throw new BotBrainBindError(
      `${nativeHarnessLabel(harness)} is not installed. Install it, then retry. This bot will not switch to Allternit cloud.`,
      'harness_missing',
    );
  }

  if (brain.nativeSessionId?.trim()) {
    try {
      const picked = await ports.pickup({
        harness,
        sessionId: brain.nativeSessionId.trim(),
        surface: 'bot',
      });
      const sessionId = picked.source?.sessionId || picked.session?.id || brain.nativeSessionId.trim();
      return { ...brain, harness, nativeSessionId: sessionId };
    } catch {
      throw new BotBrainBindError(
        `Could not resume ${nativeHarnessLabel(harness)} session ${brain.nativeSessionId}. This bot will not switch to a different brain.`,
        'session_missing',
      );
    }
  }

  const trackedId = `bot-${botId}-${harness}`;
  try {
    const picked = await ports.pickup({
      harness,
      sessionId: trackedId,
      surface: 'bot',
    });
    const sessionId = picked.source?.sessionId || picked.session?.id || trackedId;
    return { ...brain, harness, nativeSessionId: sessionId };
  } catch {
    if (!ports.spawn) {
      throw new BotBrainBindError(
        `No ${nativeHarnessLabel(harness)} session to resume. Spawn is not wired. This bot will not switch to Allternit cloud.`,
        'session_missing',
      );
    }
    let spawnedId = trackedId;
    try {
      const spawned = await ports.spawn({ harness, sessionId: trackedId });
      spawnedId = spawned.sessionId || trackedId;
    } catch {
      throw new BotBrainBindError(
        `Could not spawn a ${nativeHarnessLabel(harness)} session. This bot will not switch to a different brain.`,
        'session_missing',
      );
    }
    try {
      const picked = await ports.pickup({
        harness,
        sessionId: spawnedId,
        surface: 'bot',
      });
      const sessionId = picked.source?.sessionId || picked.session?.id || spawnedId;
      return { ...brain, harness, nativeSessionId: sessionId };
    } catch {
      // Spawn succeeded; persist the tracked id even if pickup is still racing
      // the catalog. Next start resumes this same id.
      return { ...brain, harness, nativeSessionId: spawnedId };
    }
  }
}

/** Dedup join: pane id that matches a bot's nativeSessionId is the same row. */
export function nativeSessionJoinKey(brain: BotBrainBinding | undefined): string | undefined {
  if (brain?.mode !== 'native_harness') return undefined;
  const id = brain.nativeSessionId?.trim();
  return id || undefined;
}
