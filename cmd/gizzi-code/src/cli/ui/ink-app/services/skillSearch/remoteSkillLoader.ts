/**
 * Skill Search - Remote Skill Loader
 * TEMPORARY SHIM
 */

export function loadRemoteSkill(_name: string): Promise<unknown> {
  return Promise.resolve(null)
}
export function loadRemoteSkills(): Promise<unknown[]> {
  return Promise.resolve([])
export default { loadRemoteSkill, loadRemoteSkills }
}
