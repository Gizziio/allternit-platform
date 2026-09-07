/**
 * Routine Timer (spec Phase 1)
 *
 * Mounts the bot-routine scheduler: a 60s interval runs due routines, and a
 * mount sweep catches work missed while the app was closed — startup
 * routines run once per app launch, and any non-startup routine whose
 * nextRunAt passed while the app was closed runs once and reschedules.
 * Double-runs across intervals are prevented by the in-flight guard in
 * bot-routine.service.
 *
 * @module use-routine-timer
 */

import { useEffect } from 'react';
import { runDueBotRoutines, runStartupRoutines } from './bot-routine.service';

export const ROUTINE_TIMER_INTERVAL_MS = 60_000;

export function useRoutineTimer(intervalMs: number = ROUTINE_TIMER_INTERVAL_MS): void {
  useEffect(() => {
    // Missed-due sweep on mount: startup routines fire once per launch;
    // overdue non-startup routines catch up once.
    void runStartupRoutines();
    void runDueBotRoutines();

    const timer = globalThis.setInterval(() => {
      void runDueBotRoutines();
    }, intervalMs);

    return () => globalThis.clearInterval(timer);
  }, [intervalMs]);
}
