/**
 * Routine Scratchpad (spec AD-5)
 *
 * Per-routine KV scratchpad persisted locally (Hermes cron notepad model):
 * 16KB per value, 64KB per routine; when a write would exceed the routine
 * cap, oldest entries (by updatedAt) are trimmed first. Routine instructions
 * may reference it later; for now it is written by routine tooling and read
 * by bots through their prompt context.
 *
 * @module routine-scratchpad
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createVersionedPersistOptions } from '@/lib/bots/versioned-persist';

/** 16KB per value. */
export const SCRATCHPAD_VALUE_CAP = 16 * 1024;
/** 64KB per routine. */
export const SCRATCHPAD_ROUTINE_CAP = 64 * 1024;

export interface ScratchpadEntry {
  value: string;
  updatedAt: number;
}

interface RoutineScratchpadState {
  /** Routine id → key → entry. */
  pads: Record<string, Record<string, ScratchpadEntry>>;
  setValue: (routineId: string, key: string, value: string) => void;
  clearRoutine: (routineId: string) => void;
}

function byteSize(value: string): number {
  return new TextEncoder().encode(value).length;
}

export const useRoutineScratchpadStore = create<RoutineScratchpadState>()(
  persist(
    (set) => ({
      pads: {},

      setValue: (routineId, key, value) => {
        const capped = value.slice(0, SCRATCHPAD_VALUE_CAP);
        set((state) => {
          const pad = { ...(state.pads[routineId] ?? {}) };
          pad[key] = { value: capped, updatedAt: Date.now() };

          // Enforce the per-routine cap by trimming oldest entries.
          let total = Object.values(pad).reduce((sum, e) => sum + byteSize(e.value), 0);
          if (total > SCRATCHPAD_ROUTINE_CAP) {
            const oldestFirst = Object.keys(pad).sort(
              (a, b) => (pad[a]?.updatedAt ?? 0) - (pad[b]?.updatedAt ?? 0),
            );
            for (const trimKey of oldestFirst) {
              if (total <= SCRATCHPAD_ROUTINE_CAP) break;
              total -= byteSize(pad[trimKey]?.value ?? '');
              delete pad[trimKey];
            }
          }

          return { pads: { ...state.pads, [routineId]: pad } };
        });
      },

      clearRoutine: (routineId) =>
        set((state) => {
          if (!(routineId in state.pads)) return state;
          const pads = { ...state.pads };
          delete pads[routineId];
          return { pads };
        }),
    }),
    {
      name: 'allternit-routine-scratchpads',
      ...createVersionedPersistOptions<RoutineScratchpadState>({
        schemaVersion: 1,
        migrations: { 0: (state) => state },
        partialize: (state) => ({ pads: state.pads }),
      }),
    },
  ),
);

/** Read a routine's scratchpad (plain function for non-React callers). */
export function getScratchpad(routineId: string): Record<string, ScratchpadEntry> {
  return useRoutineScratchpadStore.getState().pads[routineId] ?? {};
}

/** Write a scratchpad value, enforcing the value and routine caps. */
export function setScratchpadValue(routineId: string, key: string, value: string): void {
  useRoutineScratchpadStore.getState().setValue(routineId, key, value);
}

/** React hook subscription for a routine's scratchpad. */
export function useScratchpad(routineId: string): Record<string, ScratchpadEntry> {
  return useRoutineScratchpadStore((state) => state.pads[routineId] ?? {});
}
