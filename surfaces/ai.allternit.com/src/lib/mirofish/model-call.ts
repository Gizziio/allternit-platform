/**
 * Shared abort/timeout plumbing for every MiroFish model call.
 *
 * A browser fetch on a silently-dead socket never settles on its own —
 * observed live wedging an entire run (see docs/MIROFISH_TEST_RESULTS.md).
 * Every generateText call therefore gets a per-call timeout merged with the
 * caller's cancel signal, on every provider path (not just local dev).
 */

/**
 * Generous per-model-call ceiling — a stuck call aborts and the AI SDK
 * retries. Must absorb backend QUEUE time too: with a population fanned out
 * wider than the backend's concurrency (e.g. subprocess-backed claude), tail
 * calls legitimately wait through several waves before running.
 */
export const MODEL_CALL_TIMEOUT_MS = 180_000;

/** Merge an optional caller cancel signal with the per-call timeout. */
export function modelCallSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(MODEL_CALL_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** True when an error is a cancellation (user abort or our timeout), not a model failure. */
export function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

/** Throw a cancellation error if the caller's signal has been aborted. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Simulation cancelled", "AbortError");
  }
}
