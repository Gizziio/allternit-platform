const LABELED_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "<REDACTED:email>"],
  [/https?:\/\/[^\s"'<>]+/gi, "<REDACTED:url>"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g, "<REDACTED:jwt>"],
  [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g, "<REDACTED:github-token>"],
  [/\b(?:sk|pk|ak)-[A-Za-z0-9_-]{16,}\b/g, "<REDACTED:api-key>"],
]

const POSIX_PATH = /(?:\/[\w.~+-]+){2,}\/?/g
const WINDOWS_PATH = /\b[A-Za-z]:\\(?:[\w.~ -]+\\?){2,}/g

export function cleanTelemetryString(value: string) {
  let output = value
  for (const [pattern, replacement] of LABELED_PATTERNS) output = output.replace(pattern, replacement)
  output = output.replace(WINDOWS_PATH, "<REDACTED:path>")
  output = output.replace(POSIX_PATH, (path) => {
    const marker = path.indexOf("node_modules/")
    return marker === -1 ? "<REDACTED:path>" : path.slice(marker)
  })
  return output.slice(0, 512)
}

export function telemetryDisabled() {
  const value = (name: string) => ["1", "true", "yes"].includes((process.env[name] ?? "").toLowerCase())
  return process.env.NODE_ENV === "test" || value("DO_NOT_TRACK") || value("DISABLE_TELEMETRY") || value("GIZZI_DISABLE_TELEMETRY")
}

