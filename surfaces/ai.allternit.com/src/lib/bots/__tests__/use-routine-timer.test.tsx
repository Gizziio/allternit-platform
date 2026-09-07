/**
 * Tests for useRoutineTimer: mount sweep (startup routines + missed-due
 * catch-up) and the 60s due-routine tick.
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runDueBotRoutines, runStartupRoutines } from '../bot-routine.service';
import { useRoutineTimer, ROUTINE_TIMER_INTERVAL_MS } from '../use-routine-timer';

vi.mock('../bot-routine.service', () => ({
  runDueBotRoutines: vi.fn(async () => {}),
  runStartupRoutines: vi.fn(async () => {}),
}));

const runDueMock = vi.mocked(runDueBotRoutines);
const runStartupMock = vi.mocked(runStartupRoutines);

describe('useRoutineTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    runDueMock.mockClear();
    runStartupMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the mount sweep once: startup routines then due routines', () => {
    renderHook(() => useRoutineTimer());

    expect(runStartupMock).toHaveBeenCalledTimes(1);
    expect(runDueMock).toHaveBeenCalledTimes(1);
  });

  it('ticks due routines on the interval but never re-runs startup', () => {
    renderHook(() => useRoutineTimer());

    vi.advanceTimersByTime(ROUTINE_TIMER_INTERVAL_MS);
    expect(runDueMock).toHaveBeenCalledTimes(2);
    expect(runStartupMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(3 * ROUTINE_TIMER_INTERVAL_MS);
    expect(runDueMock).toHaveBeenCalledTimes(5);
    expect(runStartupMock).toHaveBeenCalledTimes(1);
  });

  it('stops ticking after unmount', () => {
    const { unmount } = renderHook(() => useRoutineTimer());
    unmount();

    vi.advanceTimersByTime(5 * ROUTINE_TIMER_INTERVAL_MS);
    expect(runDueMock).toHaveBeenCalledTimes(1);
  });
});
