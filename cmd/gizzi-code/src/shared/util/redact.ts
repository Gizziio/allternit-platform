/**
 * Secret redaction for log output.
 *
 * Applied to every line written through `Log` (session log file) and
 * `logForDebugging` (debug logs) so credential values can never land on disk
 * in log files. Conservative by design: only well-known token shapes and
 * obvious secret-bearing keys are masked.
 */

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g

const API_KEY_PATTERN = /\b(sk-(?:ant|proj)-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9]{16,})\b/g

const BEARER_PATTERN = /(\bBearer\s+)[A-Za-z0-9._~+/=-]{8,}\b/gi

// key=value / "key": "value" style pairs whose key names a secret.
const SECRET_KEY_PAIR_PATTERN =
  /(^|[\s{[,])([A-Za-z0-9_.-]*(?:access|refresh|id)?[Tt]oken|secret|password|passwd|api[_-]?key|apikey|authorization|credential[A-Za-z0-9_.-]*)([\s]*[=:][\s]*)("?)([^ ",}\]]{4,})/g

function maskTokenShape(match: string): string {
  return match.length <= 8 ? "***" : `${match.slice(0, 6)}…(redacted)`
}

/**
 * Mask known credential shapes and secret-bearing key/value pairs in `text`.
 * Safe to apply repeatedly (output is stable).
 */
export function redactSecrets(text: string): string {
  if (typeof text !== "string" || text.length === 0) return text

  let result = text
  result = result.replace(JWT_PATTERN, (m) => maskTokenShape(m))
  result = result.replace(API_KEY_PATTERN, (m) => maskTokenShape(m))
  result = result.replace(BEARER_PATTERN, "$1<redacted>")

  result = result.replace(
    SECRET_KEY_PAIR_PATTERN,
    (_m, lead: string, key: string, sep: string, quote: string, value: string) => {
      if (/^(true|false|null|undefined|[0-9.]+)$/.test(value)) {
        return `${lead}${key}${sep}${quote}${value}`
      }
      return `${lead}${key}${sep}${quote}<redacted>`
    },
  )

  return result
}
