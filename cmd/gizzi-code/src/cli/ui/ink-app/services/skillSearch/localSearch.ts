/**
 * Skill Search - Local Search
 * TEMPORARY SHIM
 */

export function clearSkillIndexCache(): void {
  // TODO: implement
}
export function isSkillSearchEnabled(): boolean {
  return false
export function recordSkillSearch(): void {
export function stripCanonicalPrefix(name: string): string {
  return name
export function getDiscoveredRemoteSkill(_name: string): unknown {
  return null
export function loadRemoteSkill(_name: string): Promise<unknown> {
  return Promise.resolve(null)
export function logRemoteSkillLoaded(_name: string): void {
export function loadRemoteSkills(): Promise<unknown[]> {
  return Promise.resolve([])
export default { 
  clearSkillIndexCache, 
  isSkillSearchEnabled, 
  recordSkillSearch,
  stripCanonicalPrefix,
  getDiscoveredRemoteSkill,
  loadRemoteSkill,
  logRemoteSkillLoaded,
  loadRemoteSkills,
  }
}
}
}
}
}
}
}
