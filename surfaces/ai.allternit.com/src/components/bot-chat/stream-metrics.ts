/**
 * Stream metrics (bot streaming UX).
 *
 * Client-side, stream-derived latency/rate numbers for the bot chat status
 * line: time-to-first-token (send → first content delta) and a windowed
 * tok/s rate over received deltas. Pure and clock-injectable — the view owns
 * the tracker and feeds it from stream callbacks.
 *
 * Tokens are estimated as chars/4 unless real output-token usage is supplied
 * (finish-frame usage; neither the gizzi agent-compat route nor the Rust
 * bridge currently ships it, so `estimated` stays true in practice).
 *
 * @module bot-chat/stream-metrics
 */

export interface StreamMetrics {
  /** Send → first content delta, ms. Null until the first delta arrives. */
  ttftMs: number | null;
  /** Windowed output rate over the trailing window. Null before measurable. */
  tokensPerSecond: number | null;
  /** True when tokensPerSecond comes from the chars/4 estimate. */
  estimated: boolean;
}

export interface StreamMetricsTrackerOptions {
  now?: () => number;
  /** Chars-per-token estimate. Default 4. */
  charsPerToken?: number;
  /** Rate measurement window. Default 5000 ms. */
  windowMs?: number;
  /** Minimum window span before a rate is reported. Default 200 ms. */
  minSpanMs?: number;
}

export class StreamMetricsTracker {
  private readonly now: () => number;
  private readonly charsPerToken: number;
  private readonly windowMs: number;
  private readonly minSpanMs: number;
  private sentAt: number | null = null;
  private firstTokenAt: number | null = null;
  private readonly deltas: Array<{ at: number; chars: number }> = [];
  private usageTokens: number | null = null;

  constructor(opts: StreamMetricsTrackerOptions = {}) {
    this.now = opts.now ?? (() => Date.now());
    this.charsPerToken = opts.charsPerToken ?? 4;
    this.windowMs = opts.windowMs ?? 5000;
    this.minSpanMs = opts.minSpanMs ?? 200;
  }

  /** Call once when the message is sent. */
  markSent(): void {
    if (this.sentAt === null) this.sentAt = this.now();
  }

  /** Feed every content delta (thinking deltas are excluded by the caller). */
  noteTextDelta(text: string): void {
    if (!text) return;
    const at = this.now();
    if (this.firstTokenAt === null) this.firstTokenAt = at;
    this.deltas.push({ at, chars: text.length });
  }

  /** Real output-token usage when a finish frame carries it. */
  noteUsage(outputTokens: number): void {
    if (Number.isFinite(outputTokens) && outputTokens > 0) {
      this.usageTokens = outputTokens;
    }
  }

  snapshot(): StreamMetrics {
    const now = this.now();
    const ttftMs =
      this.sentAt !== null && this.firstTokenAt !== null
        ? Math.max(0, this.firstTokenAt - this.sentAt)
        : null;

    if (
      this.usageTokens !== null &&
      this.firstTokenAt !== null &&
      now > this.firstTokenAt
    ) {
      return {
        ttftMs,
        tokensPerSecond: (this.usageTokens * 1000) / (now - this.firstTokenAt),
        estimated: false,
      };
    }

    const windowStart = now - this.windowMs;
    let chars = 0;
    let oldest: number | null = null;
    let newest: number | null = null;
    for (const delta of this.deltas) {
      if (delta.at < windowStart) continue;
      chars += delta.chars;
      if (oldest === null || delta.at < oldest) oldest = delta.at;
      if (newest === null || delta.at > newest) newest = delta.at;
    }
    if (chars === 0 || oldest === null || newest === null) {
      return { ttftMs, tokensPerSecond: null, estimated: true };
    }
    const span = Math.min(newest, now) - oldest;
    if (span < this.minSpanMs) {
      return { ttftMs, tokensPerSecond: null, estimated: true };
    }
    return {
      ttftMs,
      tokensPerSecond: chars / this.charsPerToken / (span / 1000),
      estimated: true,
    };
  }
}

/** "820ms" / "1.4s" / "12s". */
export function formatTTFT(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
}

/** "~24 tok/s" (estimated) or "24 tok/s" (real usage). */
export function formatStreamMetrics(metrics: StreamMetrics): string {
  const parts: string[] = [];
  if (metrics.ttftMs !== null) parts.push(`first token ${formatTTFT(metrics.ttftMs)}`);
  if (metrics.tokensPerSecond !== null) {
    const rate = Math.round(metrics.tokensPerSecond);
    parts.push(`${metrics.estimated ? "~" : ""}${rate} tok/s`);
  }
  return parts.join(" · ");
}
