// §A1 — ExecutionContext / PageLease / RedactingLogger boundary implementations.
import type { Page } from "playwright";
import type {
  ArtifactSink,
  ExecutionContext,
  PageLease,
  Pacer,
  RedactingLogger,
  SelectorResolver,
  SubmissionState,
  TaskAttempt,
} from "@allternit/subscription-fabric-contracts";

// §A6.8 — redact patterns reimplemented here (gateway security/redact.ts is a
// separate package; do not cross-depend).
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const LONG_DIGITS = /\b\d{6,}\b/g;
const BEARER_HEADER = /bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const API_SHAPED = /\b(?:sgw_|sk-)[A-Za-z0-9_-]{16,}\b/g;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

export function redactText(s: string): string {
  return s
    .replace(EMAIL, "[redacted:email]")
    .replace(LONG_DIGITS, "[redacted:number]")
    .replace(BEARER_HEADER, "[redacted:token]")
    .replace(API_SHAPED, "[redacted:token]")
    .replace(JWT, "[redacted:token]");
}

export function redactExcerpt(s: string, max = 500): string {
  const redacted = redactText(s);
  if (redacted.length <= max) return redacted;
  return redacted.slice(0, Math.max(0, max - 1)) + "…";
}

function redactValue(v: unknown): unknown {
  return typeof v === "string" ? redactText(v) : v;
}

export function createRedactingLogger(base: RedactingLogger): RedactingLogger {
  const fields = (f?: Record<string, unknown>): Record<string, unknown> | undefined =>
    f ? Object.fromEntries(Object.entries(f).map(([k, v]) => [k, redactValue(v)])) : undefined;
  return {
    debug: (m, f) => base.debug(redactText(m), fields(f)),
    info: (m, f) => base.info(redactText(m), fields(f)),
    warn: (m, f) => base.warn(redactText(m), fields(f)),
    error: (m, f) => base.error(redactText(m), fields(f)),
  };
}

// Contracts PageLease stays opaque to adapters; the SDK unwraps internally.
export interface SdkPageLease extends PageLease {
  readonly page: Page;
}

export function createPageLease(page: Page): SdkPageLease {
  let released = false;
  const guard = () => {
    if (released) throw new Error("PageLease used after release");
  };
  return {
    lease_id: crypto.randomUUID(),
    get page() {
      guard();
      return page;
    },
    url(): string {
      guard();
      return page.url();
    },
    async release(): Promise<void> {
      released = true;
    },
  };
}

export interface ExecutionContextInput {
  page: PageLease;
  sink: ArtifactSink;
  pacer: Pacer;
  resolver: SelectorResolver;
  logger: RedactingLogger;
  attempt: TaskAttempt;
  signal?: AbortSignal;
  // §A1 two-write rule: the worker owns persistence; the SDK flips
  // not_sent → sent_unconfirmed on the first markSubmitted call and
  // → acknowledged on the second, and awaits the durable write before returning.
  onMarkSubmitted: (
    providerThreadId: string | null,
    state: SubmissionState
  ) => Promise<void>;
}

export function createExecutionContext(input: ExecutionContextInput): ExecutionContext {
  const { attempt } = input;
  return {
    signal: input.signal ?? new AbortController().signal,
    page: input.page,
    artifacts: input.sink,
    pacing: input.pacer,
    selectors: input.resolver,
    log: input.logger,
    attempt,
    async markSubmitted(providerThreadId: string | null): Promise<void> {
      attempt.submission_state =
        attempt.submission_state === "not_sent" ? "sent_unconfirmed" : "acknowledged";
      attempt.provider_thread_id = providerThreadId;
      await input.onMarkSubmitted(providerThreadId, attempt.submission_state);
    },
  };
}
