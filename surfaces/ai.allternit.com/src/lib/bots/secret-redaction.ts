/**
 * Secret Redaction Utilities
 *
 * Lightweight heuristic detection of common secret patterns in bot memory
 * content. This is a client-side guard rail; it does not replace server-side
 * secret scanning.
 *
 * @module secret-redaction
 */

export interface DetectedSecret {
  /** Secret category, e.g. 'api_key', 'token', 'password'. */
  type: string;
  /** Start index of the match in the original content. */
  start: number;
  /** End index of the match in the original content. */
  end: number;
  /** Redacted placeholder suitable for logging or display. */
  redacted: string;
}

export interface DetectSecretsResult {
  secrets: DetectedSecret[];
  redacted: string;
}

interface SecretPattern {
  type: string;
  pattern: RegExp;
}

// Heuristic patterns for common secret shapes. Keep false-positive rate low
// by requiring surrounding context (key/token/password labels) or distinctive
// entropy prefixes.
const SECRET_PATTERNS: SecretPattern[] = [
  {
    type: 'api_key',
    pattern: /(?:api[_-]?key|apikey|api_token)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{16,})['"]?/gi,
  },
  {
    type: 'bearer_token',
    pattern: /(?:bearer\s+)([a-zA-Z0-9_\-.]{20,})/gi,
  },
  {
    type: 'private_key',
    pattern: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/gi,
  },
  {
    type: 'password',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]?([^\s'"]{8,})['"]?/gi,
  },
  {
    type: 'aws_access_key',
    pattern: /AKIA[0-9A-Z]{16}/g,
  },
  {
    type: 'slack_token',
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}(-[a-zA-Z0-9]{24})?/g,
  },
  {
    type: 'github_token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
  },
];

function redactedValue(type: string): string {
  return `[${type}:REDACTED]`;
}

/**
 * Scan content for likely secrets and return their locations plus a redacted
 * copy of the input.
 */
export function detectSecrets(content: string): DetectSecretsResult {
  const secrets: DetectedSecret[] = [];
  const ranges: Array<{ start: number; end: number; redacted: string }> = [];

  for (const { type, pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      secrets.push({
        type,
        start,
        end,
        redacted: redactedValue(type),
      });
      ranges.push({ start, end, redacted: redactedValue(type) });
    }
  }

  // Sort ranges by start position and resolve overlaps greedily.
  ranges.sort((a, b) => a.start - b.start);
  const deduped: typeof ranges = [];
  for (const range of ranges) {
    const last = deduped[deduped.length - 1];
    if (last && range.start < last.end) {
      continue;
    }
    deduped.push(range);
  }

  let redacted = content;
  for (let i = deduped.length - 1; i >= 0; i--) {
    const { start, end, redacted: replacement } = deduped[i];
    redacted = redacted.slice(0, start) + replacement + redacted.slice(end);
  }

  return { secrets, redacted };
}
