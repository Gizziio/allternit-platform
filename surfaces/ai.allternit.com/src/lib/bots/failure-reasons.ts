/**
 * Typed Failure Taxonomy
 *
 * Closed vocabulary of machine-readable failure reason codes, adapted from
 * Hermes Bot Mode (`tools/bot_failure_reasons.py`) to Allternit's provider
 * shapes: native chat turns (NativeAgentApiError with statusCode), stacked
 * CLI providers (hermes/openclaw spawn errors surfaced as text), and the
 * Grok stub (configuration errors). Codes ride ALONGSIDE free-text error
 * messages — old consumers keep working.
 *
 * Classifier precedence is the order of CLASSIFY_RULES: auth outranks quota
 * by design — real provider 401/403 bodies (e.g. Anthropic) say "invalid,
 * blocked or out of funds", so a genuine auth failure must win ties.
 *
 * Vocabulary note: `agent_blocked` is an Allternit extension beyond the
 * original Hermes agent-side codes. It maps hard-ban / execution-blocked
 * errors from the character layer and is an attention-class reason.
 *
 * @module failure-reasons
 */

export const FAILURE_REASONS = [
  'provider_auth_or_access',
  'provider_quota_limit',
  'provider_rate_limit',
  'provider_server_error',
  'context_overflow',
  'missing_config',
  'model_unavailable',
  'runtime_offline',
  'queued_expired',
  'delivery_timeout',
  'target_busy',
  'agent_blocked',
  'unknown',
] as const;

export type FailureReason = (typeof FAILURE_REASONS)[number];

export interface FailureClassification {
  reason: FailureReason;
  /** Retry policy: one immediate retry, retry only after compaction, or never. */
  retry: 'once' | 'after_compact' | 'never';
}

/** Reasons a supervisor may retry automatically without human intervention. */
const AUTO_RETRYABLE: ReadonlySet<FailureReason> = new Set([
  'runtime_offline',
  'delivery_timeout',
  'provider_rate_limit',
  'provider_server_error',
]);

/** True only for transient classes that a single retry can plausibly fix. */
export function isAutoRetryable(reason: FailureReason): boolean {
  return AUTO_RETRYABLE.has(reason);
}

/** Map a failure reason to the bot-turn retry policy (Hermes retry_action). */
export function classifyRetry(reason: FailureReason): FailureClassification {
  if (AUTO_RETRYABLE.has(reason)) return { reason, retry: 'once' };
  if (reason === 'context_overflow') return { reason, retry: 'after_compact' };
  return { reason, retry: 'never' };
}

/**
 * Persistent failure classes that badge the roster (Hermes attention model).
 * Transient classes (rate limit, server error, offline, timeouts) never
 * badge; a bot in real trouble (auth/quota/config/blocked) does.
 */
export const ATTENTION_CLASSES: ReadonlySet<FailureReason> = new Set([
  'provider_auth_or_access',
  'provider_quota_limit',
  'missing_config',
  'agent_blocked',
]);

/** Per-class user-facing hint shown next to the attention badge. */
export const ATTENTION_HINTS: Readonly<Record<FailureReason, string>> = {
  provider_auth_or_access: 'Authentication or access failed — check the bot\'s API keys and account access.',
  provider_quota_limit: 'Provider quota or balance exhausted — top up the account or lower usage.',
  missing_config: 'Required configuration or secrets are missing — open the bot\'s settings and finish setup.',
  agent_blocked: 'The bot is blocked (hard ban or policy gate) — review its character rules.',
  provider_rate_limit: 'Provider rate limit hit.',
  provider_server_error: 'Provider server error.',
  context_overflow: 'Conversation context overflowed.',
  model_unavailable: 'The configured model is unavailable.',
  runtime_offline: 'The bot\'s runtime is offline.',
  queued_expired: 'A queued turn expired before delivery.',
  delivery_timeout: 'Delivery timed out.',
  target_busy: 'The bot is busy with another turn.',
  unknown: 'Unknown failure.',
};

export function isAttentionReason(reason: FailureReason): boolean {
  return ATTENTION_CLASSES.has(reason);
}

export function attentionHintFor(reason: FailureReason): string {
  return ATTENTION_HINTS[reason];
}

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

const STATUS = String.raw`(?:error code:?\s*|status(?:\s*code)?:?\s*|http\s*)`;

interface ClassifyRule {
  pattern: RegExp;
  reason: FailureReason;
}

/** Ordered rules — first match wins. Auth is deliberately first. */
const CLASSIFY_RULES: ClassifyRule[] = [
  { pattern: new RegExp(String.raw`authentication_error|invalid api key|unauthorized|forbidden|${STATUS}(?:401|403)\b`, 'i'), reason: 'provider_auth_or_access' },
  { pattern: new RegExp(String.raw`${STATUS}402\b|out of funds|insufficient (?:funds|quota|credits?)|quota exceeded|(?:balance|billing|credit) (?:exhausted|limit)`, 'i'), reason: 'provider_quota_limit' },
  { pattern: new RegExp(String.raw`${STATUS}429\b|rate.?limit|too many requests`, 'i'), reason: 'provider_rate_limit' },
  { pattern: new RegExp(String.raw`${STATUS}5\d{2}\b|server error|bad gateway|service unavailable|overloaded|internal error`, 'i'), reason: 'provider_server_error' },
  { pattern: /context (?:length|overflow)|context_overflow|maximum context|too many tokens/i, reason: 'context_overflow' },
  { pattern: /no llm provider configured|missing config|not configured|no access token|add an api key|unconfigured/i, reason: 'missing_config' },
  { pattern: /model .*(?:not found|does not exist|unavailable)|model_not_found|unknown model/i, reason: 'model_unavailable' },
  { pattern: /not available in this environment|runtime (?:is )?offline|enoent|spawn .* failed|command not found/i, reason: 'runtime_offline' },
  { pattern: /queue.*expired|expired.*queue|queued_expired/i, reason: 'queued_expired' },
  { pattern: /etimedout|timed? ?out|timeout|aborted|aborterror/i, reason: 'delivery_timeout' },
  { pattern: /target busy|is busy|another turn (?:is )?(?:in progress|running)|already (?:running|processing)|session (?:is )?locked/i, reason: 'target_busy' },
  { pattern: /blocked by hard ban|agent_blocked|execution blocked/i, reason: 'agent_blocked' },
  { pattern: /econnrefused|enotfound|econnreset|enetunreach|failed to fetch|network error|unreachable/i, reason: 'runtime_offline' },
];

function extractErrorText(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  const parts: string[] = [];
  if (err instanceof Error) {
    parts.push(err.name, err.message);
  }
  const record = err as Record<string, unknown>;
  for (const key of ['status', 'statusCode', 'code', 'body', 'error', 'message']) {
    const value = record[key];
    if (typeof value === 'string' && value) parts.push(value);
    else if (typeof value === 'number') parts.push(String(value));
  }
  if (parts.length === 0) {
    try {
      parts.push(String(err));
    } catch {
      // Unstringifiable error; classify as unknown.
    }
  }
  return parts.filter(Boolean).join(' ');
}

/**
 * Map a raw error (Error, NativeAgentApiError, provider string, fetch
 * failure) to a closed reason code. Defaults to `unknown`.
 */
export function classifyFailure(err: unknown): FailureReason {
  const text = extractErrorText(err);
  if (!text.trim()) return 'unknown';
  for (const rule of CLASSIFY_RULES) {
    if (rule.pattern.test(text)) return rule.reason;
  }
  return 'unknown';
}
