/**
 * Telemetry redaction helpers (gizzi-code fork).
 *
 * Single choke-point sanitizer for anything that ends up in an analytics /
 * telemetry payload. The upstream `tengu_*` event metadata is typed to
 * boolean | number | undefined, but a handful of call sites (error strings)
 * bypass that via marker casts. Rather than trusting every call site, the
 * analytics sink and the RuntimeTelemetry tracker both run string values
 * through `redactTelemetryString` before they leave the process.
 *
 * Rules:
 *   - absolute paths (POSIX + Windows) → <REDACTED:path>
 *     (home directory and anything under it is always redacted)
 *   - emails, http(s) URLs with query/credentials → labeled redactions
 *   - JWTs and common API key / token shapes → labeled redactions
 *   - result truncated to MAX_REDACTED_STRING_LENGTH
 */

const MAX_REDACTED_STRING_LENGTH = 256

const LABELED_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '<REDACTED:email>'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g, '<REDACTED:jwt>'],
  [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{16,}\b/g, '<REDACTED:github-token>'],
  [/\bsk-(?:ant|proj)?-[A-Za-z0-9_-]{10,}\b/g, '<REDACTED:api-key>'],
  [/\b(?:sk|pk|ak)-[A-Za-z0-9_-]{16,}\b/g, '<REDACTED:api-key>'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '<REDACTED:aws-access-key>'],
  [/\balt_[A-Za-z0-9]{16,}\b/g, '<REDACTED:allternit-token>'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, '<REDACTED:slack-token>'],
]

// URLs: redact the whole URL (credentials, host, path, query). Internal
// hostnames are themselves identifying, so nothing is preserved.
const URL_PATTERN = /\bhttps?:\/\/[^\s"'<>]+/gi

const POSIX_PATH_PATTERN = /(?:\/[\w.~+@=-]+){2,}\/?/g
const WINDOWS_PATH_PATTERN = /\b[A-Za-z]:\\(?:[\w.~ @=-]+\\?){2,}/g

function homeDirPattern(): RegExp | null {
  try {
    // Lazy require to keep this module importable from SDK-surface files.
    const os = require('os') as typeof import('os')
    const home = os.homedir()
    if (!home || home.length < 2) return null
    const escaped = home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`${escaped}(?:\\/[^\\s'"]*)?`, 'g')
  } catch {
    return null
  }
}

let cachedHomePattern: RegExp | null | undefined

function getHomePattern(): RegExp | null {
  if (cachedHomePattern === undefined) {
    cachedHomePattern = homeDirPattern()
  }
  return cachedHomePattern
}

/**
 * Redact user-content-bearing substrings from a string destined for a
 * telemetry payload. Never throws; on regex catastrophe falls back to a
 * hard truncation.
 */
export function redactTelemetryString(value: string): string {
  if (!value) return value
  try {
    let output = value
    const homePattern = getHomePattern()
    if (homePattern) {
      output = output.replace(homePattern, '<REDACTED:path>')
    }
    // URLs first: the email pattern would otherwise match the userinfo part
    // of https://user:pass@host/path and break URL redaction.
    output = output.replace(URL_PATTERN, '<REDACTED:url>')
    for (const [pattern, replacement] of LABELED_PATTERNS) {
      output = output.replace(pattern, replacement)
    }
    output = output.replace(WINDOWS_PATH_PATTERN, '<REDACTED:path>')
    output = output.replace(POSIX_PATH_PATTERN, (match: string) => {
      const marker = match.indexOf('node_modules/')
      return marker === -1 ? '<REDACTED:path>' : match.slice(marker)
    })
    return output.slice(0, MAX_REDACTED_STRING_LENGTH)
  } catch {
    return value.slice(0, MAX_REDACTED_STRING_LENGTH)
  }
}

/**
 * Walk a telemetry metadata object and redact every string value in place.
 * Non-string scalars pass through untouched; nested objects/arrays are
 * traversed (defense in depth — payloads are supposed to be flat).
 */
export function sanitizeTelemetryMetadata<T>(metadata: T): T {
  if (typeof metadata === 'string') {
    return redactTelemetryString(metadata) as T
  }
  if (!metadata || typeof metadata !== 'object') {
    return metadata
  }
  if (Array.isArray(metadata)) {
    for (let i = 0; i < metadata.length; i++) {
      metadata[i] = sanitizeTelemetryMetadata(metadata[i])
    }
    return metadata
  }
  const record = metadata as Record<string, unknown>
  for (const key of Object.keys(record)) {
    record[key] = sanitizeTelemetryMetadata(record[key])
  }
  return metadata
}
