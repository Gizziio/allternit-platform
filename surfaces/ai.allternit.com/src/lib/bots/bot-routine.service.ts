/**
 * Bot Routine Service
 *
 * Bot-scoped recurring tasks that land in the bot's canonical chat. Routines
 * are namespaced `[bot:<botName>] <title>` and scheduled locally, following the
 * Hermes Bot Mode routine model.
 *
 * @module bot-routine.service
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/integration/api-client';
import { isToolsApiEnabled } from '@/lib/env';
import { createVersionedPersistOptions } from '@/lib/bots/versioned-persist';
import { fnv1aHex } from './bot-capability-epoch';
import { createModuleLogger } from '@/lib/logger';
import { openBotCanonicalChat } from './bot-canonical-chat.service';

const logger = createModuleLogger('BotRoutineService');

export type BotRoutineFrequency =
  | 'startup'
  | 'once'
  | 'hourly'
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'monthly'
  | 'interval';

export interface BotRoutine {
  /** Routine id, namespaced by bot. */
  id: string;
  /** Bot this routine belongs to. */
  botId: string;
  /** Bot display name at creation time. */
  botName: string;
  /** Human-readable title. */
  title: string;
  /** Instruction/prompt executed on each run. */
  instruction: string;
  /** Schedule frequency. */
  frequency: BotRoutineFrequency;
  /** For 'interval': hours between runs. */
  intervalHours?: number;
  /** Raw schedule text for 'advanced' schedules created by the simple composer. */
  scheduleText?: string;
  /** Monitor mode: run a shell command and only deliver to the chat on change. */
  monitor?: { command: string };
  /** Set by the Bot Home simple composer; distinguishes composer-created routines. */
  simple?: boolean;
  /** Whether the routine is enabled. */
  enabled: boolean;
  /** Next scheduled run timestamp. */
  nextRunAt: number;
  /** Last run timestamp, if any. */
  lastRunAt?: number;
  /** Last run result, if any. */
  lastResult?: { success: boolean; output?: string; error?: string };
  /** FNV-1a hash of the last monitor output (monitor mode). */
  lastMonitorHash?: string;
  /** Created timestamp. */
  createdAt: string;
}

export interface CreateBotRoutineInput {
  botId: string;
  botName: string;
  title: string;
  instruction: string;
  frequency: BotRoutineFrequency;
  intervalHours?: number;
  scheduleText?: string;
  monitor?: { command: string };
  /** Mark as created by the Bot Home simple composer. */
  simple?: boolean;
}

function routineId(botId: string, title: string): string {
  return `${botId}::${title}`;
}

/** Exported for tests — maps a frequency (+ interval) to the next run timestamp. */
export { calculateNextRun };

function calculateNextRun(frequency: BotRoutineFrequency, from: number = Date.now(), intervalHours?: number): number {
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;
  switch (frequency) {
    case 'startup':
      return from;
    case 'once':
      // One-shot: never due again after it runs.
      return Number.MAX_SAFE_INTEGER;
    case 'hourly':
      return from + ONE_HOUR;
    case 'daily':
      return from + ONE_DAY;
    case 'weekdays': {
      // Next weekday at the same time of day (skip Saturday/Sunday).
      let candidate = from + ONE_DAY;
      const day = new Date(candidate).getDay();
      if (day === 6) candidate += 2 * ONE_DAY; // Saturday → Monday
      else if (day === 0) candidate += ONE_DAY; // Sunday → Monday
      return candidate;
    }
    case 'weekly':
      return from + 7 * ONE_DAY;
    case 'monthly':
      return from + 30 * ONE_DAY;
    case 'interval':
      return from + Math.max(1, intervalHours ?? 24) * ONE_HOUR;
    default:
      return from + ONE_DAY;
  }
}

/** Builds the canonical routine prompt: `[bot:<name>] <title>\n\n<instruction>`. */
export function routinePrompt(botName: string, title: string, instruction: string): string {
  return `[bot:${botName}] ${title}\n\n${instruction}`;
}

interface BotRoutineState {
  routines: Record<string, BotRoutine>;
  createRoutine: (input: CreateBotRoutineInput) => BotRoutine;
  deleteRoutine: (botId: string, title: string) => void;
  enableRoutine: (botId: string, title: string) => void;
  disableRoutine: (botId: string, title: string) => void;
  recordRun: (
    id: string,
    result: BotRoutine['lastResult'],
    opts?: { monitorHash?: string },
  ) => void;
  getRoutinesForBot: (botId: string) => BotRoutine[];
  getDueRoutines: () => BotRoutine[];
}

export const useBotRoutineStore = create<BotRoutineState>()(
  persist(
    (set, get) => ({
      routines: {},

      createRoutine: (input) => {
        const id = routineId(input.botId, input.title);
        const now = Date.now();
        const routine: BotRoutine = {
          id,
          botId: input.botId,
          botName: input.botName,
          title: input.title,
          instruction: input.instruction,
          frequency: input.frequency,
          intervalHours: input.intervalHours,
          scheduleText: input.scheduleText,
          monitor: input.monitor,
          simple: input.simple,
          enabled: true,
          nextRunAt: calculateNextRun(input.frequency, now, input.intervalHours),
          createdAt: new Date(now).toISOString(),
        };
        set((state) => ({ routines: { ...state.routines, [id]: routine } }));
        logger.info({ botId: input.botId, title: input.title, frequency: input.frequency }, 'Created bot routine');
        return routine;
      },

      deleteRoutine: (botId, title) => {
        set((state) => {
          const next = { ...state.routines };
          delete next[routineId(botId, title)];
          return { routines: next };
        });
        logger.info({ botId, title }, 'Deleted bot routine');
      },

      enableRoutine: (botId, title) => {
        const id = routineId(botId, title);
        set((state) => {
          const routine = state.routines[id];
          if (!routine) return state;
          return {
            routines: {
              ...state.routines,
              [id]: {
                ...routine,
                enabled: true,
                nextRunAt: calculateNextRun(routine.frequency, Date.now(), routine.intervalHours),
              },
            },
          };
        });
      },

      disableRoutine: (botId, title) => {
        const id = routineId(botId, title);
        set((state) => {
          const routine = state.routines[id];
          if (!routine) return state;
          return {
            routines: {
              ...state.routines,
              [id]: { ...routine, enabled: false },
            },
          };
        });
      },

      recordRun: (id, result, opts) => {
        set((state) => {
          const routine = state.routines[id];
          if (!routine) return state;
          const now = Date.now();
          return {
            routines: {
              ...state.routines,
              [id]: {
                ...routine,
                lastRunAt: now,
                lastResult: result,
                lastMonitorHash: opts?.monitorHash ?? routine.lastMonitorHash,
                nextRunAt: calculateNextRun(routine.frequency, now, routine.intervalHours),
              },
            },
          };
        });
      },

      getRoutinesForBot: (botId) => {
        return Object.values(get().routines).filter((r) => r.botId === botId);
      },

      getDueRoutines: () => {
        const now = Date.now();
        return Object.values(get().routines).filter((r) => r.enabled && r.nextRunAt <= now);
      },
    }),
    {
      name: 'allternit-bot-routines',
      // schemaVersion 2 (Phase 1): additive shape change — new frequency
      // values ('once'|'hourly'|'weekdays'|'interval'), intervalHours,
      // scheduleText, monitor, simple, lastMonitorHash. v1→v2 is identity
      // (all new fields optional); the chain runs v0→v1→v2 on old data.
      ...createVersionedPersistOptions<BotRoutineState>({
        schemaVersion: 2,
        migrations: {
          0: (state) => state,
          1: (state) => state,
        },
        partialize: (state) => ({ routines: state.routines }),
      }),
    },
  ),
);

/**
 * Routine delivery semantics (spec AD-5):
 * - Output lands as a real inbound turn in the bot's canonical chat.
 * - Continuity (`context_from: self`): the previous run's output is prepended
 *   (capped at 2KB) so each run builds on the last.
 * - Monitor mode runs a shell command via the local tools API and hashes the
 *   output; a run whose hash matches the last delivery is silent (no LLM, no
 *   chat message). On change (or first run) the output (capped at 4KB) is
 *   delivered to the canonical chat.
 */
export async function executeBotRoutine(routine: BotRoutine): Promise<void> {
  try {
    if (routine.monitor?.command) {
      await executeMonitorRoutine(routine);
      return;
    }

    const sessionId = await openBotCanonicalChat({
      botId: routine.botId,
      botName: routine.botName,
      setActive: false,
    });

    const { useChatSessionStore } = await import('@/views/chat/ChatSessionStore');
    await useChatSessionStore.getState().sendMessage(sessionId, {
      text: routinePrompt(routine.botName, routine.title, withContinuity(routine)),
      skipContext: false,
    });

    useBotRoutineStore.getState().recordRun(routine.id, {
      success: true,
      output: `Routine sent to ${routine.botName}`,
    });
    logger.info({ routineId: routine.id }, 'Bot routine executed');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    useBotRoutineStore.getState().recordRun(routine.id, { success: false, error: message });
    logger.error({ err, routineId: routine.id }, 'Bot routine execution failed');
  }
}

const PREVIOUS_OUTPUT_CAP = 2 * 1024;

/** Prepend the previous run's output so the routine can build on it. */
function withContinuity(routine: BotRoutine): string {
  const previous = routine.lastResult?.output;
  if (!previous || !routine.lastResult?.success) return routine.instruction;
  return `${routine.instruction}\n\nPrevious run output:\n${previous.slice(0, PREVIOUS_OUTPUT_CAP)}`;
}

const MONITOR_OUTPUT_CAP = 4 * 1024;

async function executeMonitorRoutine(routine: BotRoutine): Promise<void> {
  // The shell tool is served only by the local Rust allternit-api — fail
  // closed with a typed missing_config outcome instead of firing requests
  // into a deployment that does not serve it.
  if (!isToolsApiEnabled()) {
    useBotRoutineStore.getState().recordRun(routine.id, {
      success: false,
      error: 'Monitor requires local API',
    });
    logger.warn({ routineId: routine.id }, 'Monitor routine skipped: local tools API unreachable');
    return;
  }

  const response = (await api.executeTool('shell', {
    command: routine.monitor!.command,
  })) as { success: boolean; output?: string; error?: string };
  if (!response.success) {
    useBotRoutineStore.getState().recordRun(routine.id, {
      success: false,
      error: response.error || 'Monitor command failed',
    });
    return;
  }

  const output = (response.output ?? '').slice(0, MONITOR_OUTPUT_CAP);
  const monitorHash = fnv1aHex(output);
  if (routine.lastMonitorHash && routine.lastMonitorHash === monitorHash) {
    // Silent run: no change since the last delivery — skip the LLM turn.
    useBotRoutineStore.getState().recordRun(routine.id, { success: true, output: 'no change' });
    logger.info({ routineId: routine.id }, 'Monitor routine: no change');
    return;
  }

  const sessionId = await openBotCanonicalChat({
    botId: routine.botId,
    botName: routine.botName,
    setActive: false,
  });
  const { useChatSessionStore } = await import('@/views/chat/ChatSessionStore');
  await useChatSessionStore.getState().sendMessage(sessionId, {
    text: routinePrompt(routine.botName, routine.title, output),
    skipContext: false,
  });

  useBotRoutineStore.getState().recordRun(
    routine.id,
    { success: true, output: `Monitor change delivered to ${routine.botName}` },
    { monitorHash },
  );
  logger.info({ routineId: routine.id }, 'Monitor routine delivered change');
}

/** Routines currently executing, keyed by routine id (double-run guard). */
const routinesInFlight = new Set<string>();

/**
 * Run all due routines. Safe to call from a timer or page-focus handler.
 * Startup routines only run when explicitly included (the timer excludes
 * them; the mount sweep runs them once per app launch).
 */
export async function runDueBotRoutines(options?: { includeStartup?: boolean }): Promise<void> {
  const due = useBotRoutineStore
    .getState()
    .getDueRoutines()
    .filter((r) => options?.includeStartup === true || r.frequency !== 'startup');
  for (const routine of due) {
    if (routinesInFlight.has(routine.id)) continue;
    routinesInFlight.add(routine.id);
    try {
      await executeBotRoutine(routine);
    } finally {
      routinesInFlight.delete(routine.id);
    }
  }
}

/**
 * Run startup-frequency routines once (called by the routine timer's mount
 * sweep). Startup routines are due by definition at every app launch.
 */
export async function runStartupRoutines(): Promise<void> {
  const startup = Object.values(useBotRoutineStore.getState().routines).filter(
    (r) => r.enabled && r.frequency === 'startup',
  );
  for (const routine of startup) {
    if (routinesInFlight.has(routine.id)) continue;
    routinesInFlight.add(routine.id);
    try {
      await executeBotRoutine(routine);
    } finally {
      routinesInFlight.delete(routine.id);
    }
  }
}

/**
 * Create a bot routine convenience helper.
 */
export function createBotRoutine(input: CreateBotRoutineInput): BotRoutine {
  return useBotRoutineStore.getState().createRoutine(input);
}

/**
 * Delete a bot routine convenience helper.
 */
export function deleteBotRoutine(botId: string, title: string): void {
  useBotRoutineStore.getState().deleteRoutine(botId, title);
}

/**
 * Enable a bot routine convenience helper.
 */
export function enableBotRoutine(botId: string, title: string): void {
  useBotRoutineStore.getState().enableRoutine(botId, title);
}

/**
 * Disable a bot routine convenience helper.
 */
export function disableBotRoutine(botId: string, title: string): void {
  useBotRoutineStore.getState().disableRoutine(botId, title);
}

/**
 * List routines for a bot convenience helper.
 */
export function getRoutinesForBot(botId: string): BotRoutine[] {
  return useBotRoutineStore.getState().getRoutinesForBot(botId);
}
