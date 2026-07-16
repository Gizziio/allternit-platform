/**
 * Compatibility surface for background-session task summaries.
 *
 * The background-session feature is not packaged in this distribution yet.
 * These no-op exports keep the feature-gated production import resolvable.
 */

export function shouldGenerateTaskSummary(): boolean {
  return false
}

export function maybeGenerateTaskSummary(_context: unknown): void {
  // Intentionally disabled until background-session summaries are packaged.
}
