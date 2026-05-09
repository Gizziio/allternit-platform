/**
 * Background scheduler for Orbit daily digests.
 * Checks every 60s if it's time to auto-generate.
 * Persists schedule config in localStorage.
 */

import { useEffect, useRef, useCallback } from 'react';

const SCHEDULE_KEY = 'allternit-design-orbit-schedule';

export interface OrbitSchedule {
  enabled: boolean;
  hour: number;      // 0-23
  minute: number;    // 0-59
  lastGeneratedAt: string | null; // ISO string
}

export function loadSchedule(): OrbitSchedule {
  if (typeof window === 'undefined') {
    return { enabled: false, hour: 9, minute: 0, lastGeneratedAt: null };
  }
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { enabled: false, hour: 9, minute: 0, lastGeneratedAt: null };
}

export function saveSchedule(schedule: OrbitSchedule) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
}

function shouldGenerate(schedule: OrbitSchedule): boolean {
  if (!schedule.enabled) return false;

  const now = new Date();
  const scheduledToday = new Date(now);
  scheduledToday.setHours(schedule.hour, schedule.minute, 0, 0);

  // If scheduled time hasn't happened yet today, don't generate
  if (now < scheduledToday) return false;

  // If never generated before, and we're past scheduled time, generate
  if (!schedule.lastGeneratedAt) return true;

  const lastGen = new Date(schedule.lastGeneratedAt);

  // If last generation was before today's scheduled time, generate
  return lastGen < scheduledToday;
}

export function useOrbitScheduler(onGenerate: () => void | Promise<void>) {
  const scheduleRef = useRef<OrbitSchedule>(loadSchedule());
  const onGenerateRef = useRef(onGenerate);

  onGenerateRef.current = onGenerate;

  const checkAndGenerate = useCallback(async () => {
    const schedule = loadSchedule();
    scheduleRef.current = schedule;

    if (shouldGenerate(schedule)) {
      await onGenerateRef.current();
      // Update lastGeneratedAt
      const updated = { ...schedule, lastGeneratedAt: new Date().toISOString() };
      saveSchedule(updated);
      scheduleRef.current = updated;
    }
  }, []);

  useEffect(() => {
    // Initial check (might have missed while tab was closed)
    checkAndGenerate();

    // Then check every 60 seconds
    const interval = setInterval(checkAndGenerate, 60_000);

    // Also check when tab becomes visible again (user returns to app)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkAndGenerate();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [checkAndGenerate]);

  return {
    getSchedule: () => scheduleRef.current,
    saveSchedule,
  };
}
