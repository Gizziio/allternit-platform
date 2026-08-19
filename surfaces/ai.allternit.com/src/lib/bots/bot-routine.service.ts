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
import { createBrowserJSONStorage } from '@/lib/zustand-browser-storage';
import { createModuleLogger } from '@/lib/logger';
import { openBotCanonicalChat } from './bot-canonical-chat.service';

const logger = createModuleLogger('BotRoutineService');

export type BotRoutineFrequency = 'startup' | 'daily' | 'weekly' | 'monthly';

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
  /** Whether the routine is enabled. */
  enabled: boolean;
  /** Next scheduled run timestamp. */
  nextRunAt: number;
  /** Last run timestamp, if any. */
  lastRunAt?: number;
  /** Last run result, if any. */
  lastResult?: { success: boolean; output?: string; error?: string };
  /** Created timestamp. */
  createdAt: string;
}

export interface CreateBotRoutineInput {
  botId: string;
  botName: string;
  title: string;
  instruction: string;
  frequency: BotRoutineFrequency;
}

function routineId(botId: string, title: string): string {
  return `${botId}::${title}`;
}

function calculateNextRun(frequency: BotRoutineFrequency, from: number = Date.now()): number {
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;
  switch (frequency) {
    case 'startup':
      return from;
    case 'daily':
      return from + ONE_DAY;
    case 'weekly':
      return from + 7 * ONE_DAY;
    case 'monthly':
      return from + 30 * ONE_DAY;
    default:
      return from + ONE_DAY;
  }
}

function routinePrompt(botName: string, title: string, instruction: string): string {
  return `[bot:${botName}] ${title}\n\n${instruction}`;
}

interface BotRoutineState {
  routines: Record<string, BotRoutine>;
  createRoutine: (input: CreateBotRoutineInput) => BotRoutine;
  deleteRoutine: (botId: string, title: string) => void;
  enableRoutine: (botId: string, title: string) => void;
  disableRoutine: (botId: string, title: string) => void;
  recordRun: (id: string, result: BotRoutine['lastResult']) => void;
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
          enabled: true,
          nextRunAt: calculateNextRun(input.frequency, now),
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
                nextRunAt: calculateNextRun(routine.frequency),
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

      recordRun: (id, result) => {
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
                nextRunAt: calculateNextRun(routine.frequency, now),
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
      storage: createBrowserJSONStorage(),
      partialize: (state) => ({ routines: state.routines }),
    },
  ),
);

/**
 * Execute a single bot routine: open the bot's canonical chat and send the
 * routine prompt. Records the result in the store.
 */
export async function executeBotRoutine(routine: BotRoutine): Promise<void> {
  try {
    const sessionId = await openBotCanonicalChat({
      botId: routine.botId,
      botName: routine.botName,
      setActive: false,
    });

    const { useChatSessionStore } = await import('@/views/chat/ChatSessionStore');
    await useChatSessionStore.getState().sendMessage(sessionId, {
      text: routinePrompt(routine.botName, routine.title, routine.instruction),
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

/**
 * Run all due routines. Safe to call from a timer or page-focus handler.
 */
export async function runDueBotRoutines(): Promise<void> {
  const due = useBotRoutineStore.getState().getDueRoutines();
  for (const routine of due) {
    await executeBotRoutine(routine);
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
