/**
 * Tests for the shared runtime-availability store:
 * - markRuntimeUnavailable flips the snapshot (with default reason) and
 *   dedups identical reports so subscribers re-render once, not per report;
 * - markRuntimeAvailable clears it, and repeated clears are no-ops;
 * - isRuntimeUnavailableBody / detectRuntimeUnavailable recognize the
 *   interceptor's synthetic 503 payload only.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, expect, it, afterEach } from 'vitest';
import {
  useRuntimeAvailable,
  markRuntimeAvailable,
  markRuntimeUnavailable,
  isRuntimeUnavailableBody,
  detectRuntimeUnavailable,
} from './useRuntimeAvailable';

const DEFAULT_REASON =
  'No paired Allternit runtime is online. Open Allternit Desktop or start your VPS runtime.';

function Probe({ onValue }: { onValue: (v: ReturnType<typeof useRuntimeAvailable>) => void }) {
  const value = useRuntimeAvailable();
  onValue(value);
  return null;
}

afterEach(() => {
  // The store is module-level; leave it available for other suites.
  act(() => markRuntimeAvailable());
});

describe('useRuntimeAvailable', () => {
  it('starts available and reports the unavailable reason after marking', () => {
    const seen: Array<ReturnType<typeof useRuntimeAvailable>> = [];
    render(<Probe onValue={(v) => seen.push(v)} />);

    expect(seen.at(-1)).toEqual({ runtimeAvailable: true, runtimeUnavailableReason: null });

    act(() => markRuntimeUnavailable('runtime rebooting'));
    expect(seen.at(-1)).toEqual({
      runtimeAvailable: false,
      runtimeUnavailableReason: 'runtime rebooting',
    });
  });

  it('falls back to the default reason when none is given', () => {
    const seen: Array<ReturnType<typeof useRuntimeAvailable>> = [];
    render(<Probe onValue={(v) => seen.push(v)} />);

    act(() => markRuntimeUnavailable());
    expect(seen.at(-1)!.runtimeUnavailableReason).toBe(DEFAULT_REASON);
  });

  it('dedups identical marks: two reports produce a single re-render', () => {
    const seen: Array<ReturnType<typeof useRuntimeAvailable>> = [];
    render(<Probe onValue={(v) => seen.push(v)} />);
    const rendersBefore = seen.length;

    act(() => {
      markRuntimeUnavailable('same reason');
      markRuntimeUnavailable('same reason');
    });

    expect(seen.length).toBe(rendersBefore + 1);
  });

  it('markRuntimeAvailable clears the state once and dedups repeated clears', () => {
    const seen: Array<ReturnType<typeof useRuntimeAvailable>> = [];
    render(<Probe onValue={(v) => seen.push(v)} />);

    act(() => markRuntimeUnavailable('down'));
    expect(seen.at(-1)!.runtimeAvailable).toBe(false);

    act(() => {
      markRuntimeAvailable();
      markRuntimeAvailable();
    });
    expect(seen.at(-1)).toEqual({ runtimeAvailable: true, runtimeUnavailableReason: null });
  });
});

describe('isRuntimeUnavailableBody', () => {
  it('matches only the synthetic runtime_unavailable payload shape', () => {
    expect(isRuntimeUnavailableBody({ error: 'runtime_unavailable' })).toBe(true);
    expect(isRuntimeUnavailableBody({ error: 'rate_limited' })).toBe(false);
    expect(isRuntimeUnavailableBody({})).toBe(false);
    expect(isRuntimeUnavailableBody('runtime_unavailable')).toBe(false);
    expect(isRuntimeUnavailableBody(null)).toBe(false);
  });
});

describe('detectRuntimeUnavailable', () => {
  it('detects the synthetic 503 and reads the message as the reason', async () => {
    const res = new Response(
      JSON.stringify({ error: 'runtime_unavailable', message: 'desktop offline' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
    await expect(detectRuntimeUnavailable(res)).resolves.toEqual({
      unavailable: true,
      reason: 'desktop offline',
    });
  });

  it('ignores other 503 bodies and non-503 statuses', async () => {
    const otherBody = new Response(JSON.stringify({ error: 'upstream_error' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
    await expect(detectRuntimeUnavailable(otherBody)).resolves.toEqual({ unavailable: false });

    const wrongStatus = new Response(
      JSON.stringify({ error: 'runtime_unavailable' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
    await expect(detectRuntimeUnavailable(wrongStatus)).resolves.toEqual({ unavailable: false });
  });
});
