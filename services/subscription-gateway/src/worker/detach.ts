// §A8/Critical #3 — detached watch polling: resume(token) on read-only watch
// pages, exponential backoff capped at 15 min. Timers are injectable so tests
// drive the schedule deterministically.
import type { ResumeToken } from "@allternit/subscription-fabric-contracts";

export const WATCH_BACKOFF_CAP_S = 900;

// Returns true when the watch reached a terminal state (done/error) and no
// further polls should be scheduled.
export type WatchPoll = (token: ResumeToken) => Promise<boolean>;

export interface WatchHandle {
  readonly tokenId: string;
  cancel(): void;
}

export interface WatchSchedulerDeps {
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (handle: unknown) => void;
  backoffCapS?: number;
}

export interface WatchScheduler {
  scheduleWatch(token: ResumeToken, pollAfterS: number, poll: WatchPoll): WatchHandle;
  cancel(tokenId: string): void;
  pending(): number;
}

export function createWatchScheduler(deps: WatchSchedulerDeps = {}): WatchScheduler {
  const setTimeoutFn = deps.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimeoutFn = deps.clearTimeoutFn ?? ((h) => clearTimeout(h as NodeJS.Timeout));
  const capS = deps.backoffCapS ?? WATCH_BACKOFF_CAP_S;
  const watches = new Map<string, { handle: unknown; cancelled: boolean }>();

  function schedule(token: ResumeToken, delayS: number, poll: WatchPoll): void {
    const handle = setTimeoutFn(() => {
      void (async () => {
        const w = watches.get(token.token);
        if (!w || w.cancelled) return;
        let terminal = false;
        try {
          terminal = await poll(token);
        } catch {
          terminal = false; // a failed poll reschedules; the stall watchdog owns failing the task
        }
        const still = watches.get(token.token);
        if (!still || still.cancelled || terminal) {
          watches.delete(token.token);
          return;
        }
        schedule(token, Math.min(delayS * 2, capS), poll);
      })();
    }, delayS * 1000);
    watches.set(token.token, { handle, cancelled: false });
  }

  return {
    scheduleWatch(token, pollAfterS, poll) {
      schedule(token, pollAfterS, poll);
      return {
        tokenId: token.token,
        cancel() {
          const w = watches.get(token.token);
          if (w) {
            w.cancelled = true;
            clearTimeoutFn(w.handle);
            watches.delete(token.token);
          }
        },
      };
    },
    cancel(tokenId) {
      const w = watches.get(tokenId);
      if (w) {
        w.cancelled = true;
        clearTimeoutFn(w.handle);
        watches.delete(tokenId);
      }
    },
    pending() {
      return watches.size;
    },
  };
}
