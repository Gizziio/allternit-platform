/**
 * Haptics (Phase 1B).
 *
 * Thin guarded wrappers over `navigator.vibrate`. No-op silently where the
 * API is absent (iOS Safari) or throws — haptics are seasoning, never a
 * failure surface. No haptics on streamed tokens; only on user actions that
 * commit something (send, approval answer).
 *
 * @module bot-chat/haptics
 */

function buzz(pattern: number | number[]): void {
  try {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Never throw over haptics.
  }
}

/** A short tick when a message sends. */
export function vibrateSend(): void {
  buzz(10);
}

/** A double-tap when an approval is answered — it unblocks the agent. */
export function vibrateApproval(): void {
  buzz([15, 40, 15]);
}
