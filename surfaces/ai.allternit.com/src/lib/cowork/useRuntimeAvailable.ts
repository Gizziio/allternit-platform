'use client';

import { useSyncExternalStore } from 'react';

/**
 * Shared runtime-availability state.
 *
 * In production the fetch interceptor (src/lib/fetch-interceptor.ts) answers
 * same-origin runtime API calls with a synthetic 503 when no paired desktop /
 * VPS runtime is online. The exact body shape it synthesizes is:
 *
 *   { "error": "runtime_unavailable",
 *     "message": "No paired Allternit runtime is online. Open Allternit
 *                 Desktop or start your VPS runtime." }
 *
 * Callers that see that body report it here so every subscribed surface can
 * render a visible "runtime offline" state instead of silently degrading to
 * empty lists. Dedup is centralized: the first report flips the store to
 * unavailable, later identical reports are no-ops, and any successful runtime
 * call re-arms it via markRuntimeAvailable().
 */

const DEFAULT_REASON =
  'No paired Allternit runtime is online. Open Allternit Desktop or start your VPS runtime.';

interface RuntimeAvailabilitySnapshot {
  unavailable: boolean;
  reason: string | null;
}

let snapshot: RuntimeAvailabilitySnapshot = { unavailable: false, reason: null };
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RuntimeAvailabilitySnapshot {
  return snapshot;
}

function setSnapshot(next: RuntimeAvailabilitySnapshot): void {
  if (next.unavailable === snapshot.unavailable && next.reason === snapshot.reason) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

/** True when a parsed response body is the interceptor's synthetic runtime_unavailable payload. */
export function isRuntimeUnavailableBody(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { error?: unknown }).error === 'runtime_unavailable'
  );
}

/**
 * Inspect a non-ok fetch Response for the synthetic 503 body. Reads a clone,
 * so callers can still surface the raw failure afterward.
 */
export async function detectRuntimeUnavailable(
  response: Response,
): Promise<{ unavailable: boolean; reason?: string }> {
  if (response.status !== 503) return { unavailable: false };
  try {
    const body = await response.clone().json();
    if (isRuntimeUnavailableBody(body)) {
      return {
        unavailable: true,
        reason:
          typeof (body as { message?: unknown }).message === 'string'
            ? (body as { message: string }).message
            : undefined,
      };
    }
  } catch {
    // Not the JSON shape we key on — some other 503.
  }
  return { unavailable: false };
}

/** Report that a runtime API call returned runtime_unavailable. Deduped. */
export function markRuntimeUnavailable(reason?: string | null): void {
  setSnapshot({
    unavailable: true,
    reason: reason ?? snapshot.reason ?? DEFAULT_REASON,
  });
}

/** Report a successful runtime API call — clears the unavailable state. */
export function markRuntimeAvailable(): void {
  setSnapshot({ unavailable: false, reason: null });
}

/** Open the app's settings surface at the runtime (remote-control) section. */
export function openRuntimeSettings(): void {
  window.dispatchEvent(
    new CustomEvent('allternit:open-settings', { detail: { section: 'remote-control' } }),
  );
}

export interface RuntimeAvailability {
  runtimeAvailable: boolean;
  runtimeUnavailableReason: string | null;
}

export function useRuntimeAvailable(): RuntimeAvailability {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  return {
    runtimeAvailable: !state.unavailable,
    runtimeUnavailableReason: state.unavailable ? state.reason : null,
  };
}
