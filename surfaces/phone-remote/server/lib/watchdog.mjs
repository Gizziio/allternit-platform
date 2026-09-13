// watchdog.mjs — frame-freshness watchdog for the sckit capture path.
// The sc_capture helper streams at the configured fps (default 10), so a
// silent gap far longer than one frame period means the helper hung — the
// Sept-13-2026 incident: the child froze at 8:04pm and the server kept
// serving lastFrame for hours with no error anywhere.
//
// Pure timing judgment is factored into isStale() so it is testable without
// a screen; FrameWatchdog wraps it in a resettable timer. The owner
// (Capture) decides what "stale" means — kill + restart once, then declare
// the capture dead and let a supervisor restart the whole server.

/**
 * Pure freshness judgment: has the capture gone quiet for longer than
 * staleMs? lastFrameAt === null means no frame has ever arrived — that is
 * "not yet started", not "stale", so it returns false.
 */
export function isStale(lastFrameAt, now, staleMs) {
  return lastFrameAt !== null && now - lastFrameAt > staleMs;
}

const defaultSchedule = (fn, ms) => {
  const timer = setTimeout(fn, ms);
  timer.unref?.();
  return timer;
};
const defaultCancel = (timer) => clearTimeout(timer);

export class FrameWatchdog {
  /**
   * @param {object} opts
   * @param {number} [opts.staleMs]   silence window before onStale fires.
   * @param {(msg: string) => void} [opts.log]
   * @param {() => void} opts.onStale called (at most once per arming) when no
   *   frame reset arrived within staleMs.
   * @param {(fn: () => void, ms: number) => unknown} [opts.schedule] timer
   *   factory — injectable so tests drive deadlines deterministically.
   * @param {(handle: unknown) => void} [opts.cancel]
   */
  constructor({ staleMs = 5000, log = console.error, onStale, schedule = defaultSchedule, cancel = defaultCancel } = {}) {
    this.staleMs = staleMs;
    this.log = log;
    this.onStale = onStale;
    this.schedule = schedule;
    this.cancel = cancel;
    this.timer = null;
    this.lastFrameAt = null;
  }

  /** Arm the watchdog. Fires onStale after staleMs unless reset() lands first. */
  arm() {
    this.disarm();
    const timer = this.schedule(() => {
      // A reset()/disarm() may have superseded this deadline already.
      if (this.timer !== timer) return;
      this.timer = null;
      this.log(`[watchdog] no frame for >${this.staleMs}ms — capture is frozen`);
      this.onStale?.();
    }, this.staleMs);
    this.timer = timer;
  }

  /** Frame arrived: push the deadline out by staleMs. No-op when not armed. */
  reset() {
    if (!this.timer) return;
    this.lastFrameAt = Date.now();
    this.arm();
  }

  /** Disarm (stop(), child exit, non-sckit fallback). */
  disarm() {
    if (this.timer) this.cancel(this.timer);
    this.timer = null;
  }

  get armed() {
    return this.timer !== null;
  }
}
