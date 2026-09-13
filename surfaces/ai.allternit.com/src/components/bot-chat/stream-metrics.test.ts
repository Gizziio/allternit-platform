import { describe, expect, it } from "vitest";
import {
  StreamMetricsTracker,
  formatStreamMetrics,
  formatTTFT,
} from "./stream-metrics";

/**
 * Deterministic clock: a fixed base plus a manually advanced offset.
 */
function makeClock(base = 1_000_000) {
  let offset = 0;
  return {
    now: () => base + offset,
    advance: (ms: number) => {
      offset += ms;
    },
  };
}

describe("StreamMetricsTracker", () => {
  it("reports ttft from send to first delta and null before any delta", () => {
    const clock = makeClock();
    const tracker = new StreamMetricsTracker({ now: clock.now });

    tracker.markSent();
    expect(tracker.snapshot().ttftMs).toBeNull();

    clock.advance(1400);
    tracker.noteTextDelta("Hello");
    const snap = tracker.snapshot();
    expect(snap.ttftMs).toBe(1400);
  });

  it("estimates tok/s as chars/4 over the trailing window", () => {
    const clock = makeClock();
    const tracker = new StreamMetricsTracker({ now: clock.now, windowMs: 5000 });

    tracker.markSent();
    clock.advance(500);
    // 1s of deltas at 40 chars/s → 10 tokens/s estimated.
    for (let i = 0; i < 10; i += 1) {
      tracker.noteTextDelta("xxxx");
      clock.advance(100);
    }
    const snap = tracker.snapshot();
    expect(snap.estimated).toBe(true);
    expect(snap.tokensPerSecond).toBeGreaterThan(8);
    expect(snap.tokensPerSecond).toBeLessThan(12);
  });

  it("drops deltas outside the window from the rate", () => {
    const clock = makeClock();
    const tracker = new StreamMetricsTracker({ now: clock.now, windowMs: 1000 });

    tracker.markSent();
    clock.advance(100);
    tracker.noteTextDelta("x".repeat(400)); // 100 tokens, but 10s ago
    clock.advance(10_000);
    const snap = tracker.snapshot();
    expect(snap.tokensPerSecond).toBeNull();
  });

  it("prefers real usage over the chars/4 estimate", () => {
    const clock = makeClock();
    const tracker = new StreamMetricsTracker({ now: clock.now });

    tracker.markSent();
    clock.advance(500);
    tracker.noteTextDelta("whatever");
    clock.advance(1500);
    tracker.noteUsage(30); // real output tokens
    const snap = tracker.snapshot();
    expect(snap.estimated).toBe(false);
    // 30 tokens over 1.5s → 20 tok/s.
    expect(snap.tokensPerSecond).toBeCloseTo(20, 0);
  });

  it("ignores empty deltas and invalid usage", () => {
    const clock = makeClock();
    const tracker = new StreamMetricsTracker({ now: clock.now });

    tracker.markSent();
    tracker.noteTextDelta("");
    tracker.noteUsage(0);
    tracker.noteUsage(Number.NaN);
    clock.advance(100);
    const snap = tracker.snapshot();
    expect(snap.ttftMs).toBeNull();
    expect(snap.tokensPerSecond).toBeNull();
  });
});

describe("formatting", () => {
  it("formats ttft as ms under a second, otherwise seconds", () => {
    expect(formatTTFT(820)).toBe("820ms");
    expect(formatTTFT(1400)).toBe("1.4s");
    expect(formatTTFT(12_300)).toBe("12s");
  });

  it("joins ttft and rate, marking the estimate with ~", () => {
    expect(
      formatStreamMetrics({ ttftMs: 1400, tokensPerSecond: 24.4, estimated: true }),
    ).toBe("first token 1.4s · ~24 tok/s");
    expect(
      formatStreamMetrics({ ttftMs: null, tokensPerSecond: 24.4, estimated: false }),
    ).toBe("24 tok/s");
    expect(
      formatStreamMetrics({ ttftMs: 500, tokensPerSecond: null, estimated: true }),
    ).toBe("first token 500ms");
    expect(
      formatStreamMetrics({ ttftMs: null, tokensPerSecond: null, estimated: true }),
    ).toBe("");
  });
});
