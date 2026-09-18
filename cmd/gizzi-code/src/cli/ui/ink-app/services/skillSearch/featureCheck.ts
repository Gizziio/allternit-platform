/**
 * Skill Search - Feature Check
 * TEMPORARY SHIM
 */

export function isSkillSearchEnabled(): boolean {
  return false
}

export function recordSkillSearch(): void {
  // TODO: implement
}

export function stripCanonicalPrefix(name: string): string {
  return name
}

export default { isSkillSearchEnabled, recordSkillSearch, stripCanonicalPrefix }
