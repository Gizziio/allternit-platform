// §A6.8 — redaction for audit excerpts (QuotaSignal.raw_excerpt-style),
// failure screenshots/DOM snapshots, and logs.

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

// Bounded audit string: redact first, then hard-truncate to `max` chars.
export function redactExcerpt(s: string, max = 500): string {
  const redacted = redactText(s);
  if (redacted.length <= max) return redacted;
  return redacted.slice(0, Math.max(0, max - 1)) + "…";
}
