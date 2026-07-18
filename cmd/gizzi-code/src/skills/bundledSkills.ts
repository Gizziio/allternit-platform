/**
 * Bundled skills
 */
import logger from '../shared/utils/log.js'

const log = logger.log

export function getBundledSkills(): string[] {
  return []
}

export function registerBundledSkill(_skill: any): void {
  log('debug', 'registerBundledSkill', _skill)
}

export default {
  getBundledSkills,
  registerBundledSkill,
}
