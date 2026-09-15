/**
 * Compatibility surface for the experimental skill-search prefetcher.
 *
 * Skill search is disabled by featureCheck.ts. Keeping the complete API as a
 * no-op lets production bundles resolve their feature-gated imports without
 * advertising or partially enabling an unfinished feature.
 */

export type PendingSkillDiscoveryPrefetch = never

export function startSkillDiscoveryPrefetch(
  _input: string | null,
  _messages: readonly unknown[],
  _toolUseContext: unknown,
): PendingSkillDiscoveryPrefetch | null {
  return null
}

export async function collectSkillDiscoveryPrefetch(
  _pending: PendingSkillDiscoveryPrefetch,
): Promise<never[]> {
  return []
}

export async function getTurnZeroSkillDiscovery(
  _input: string,
  _messages: readonly unknown[],
  _toolUseContext: unknown,
): Promise<never[]> {
  return []
}
