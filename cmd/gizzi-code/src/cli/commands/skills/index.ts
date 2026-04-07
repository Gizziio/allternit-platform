/**
 * Skills Command
 * Production-quality skill management
 */

import { loadSkillsDir, searchSkills, installSkill, uninstallSkill, clearSkillIndexCache, getSkill } from '../../../skills/loadSkillsDir.js'
import { log } from '../../utils/log.js'
import { join } from 'path'
import { homedir } from 'os'

/**
 * Get skills directories
 */
function getSkillsDirs(): string[] {
  return [
    join(homedir(), '.config', 'gizzi', 'skills'),
    join(process.cwd(), '.gizzi', 'skills'),
  ]
}

/**
 * List all available skills
 */
async function listSkills(): Promise<void> {
  const dirs = getSkillsDirs()
  const allSkills: { skill: import('../../../skills/loadSkillsDir.js').Skill; source: string }[] = []
  
  for (const dir of dirs) {
    const skills = await loadSkillsDir(dir)
    for (const skill of skills) {
      allSkills.push({ skill, source: dir })
    }
  }
  
  if (allSkills.length === 0) {
    log('info', 'No skills installed')
    log('info', 'Use `gizzi skills install <path>` to add skills')
    return
  }
  
  log('info', `Installed skills (${allSkills.length}):`)
  for (const { skill } of allSkills) {
    const tags = skill.tags?.length ? ` [${skill.tags.join(', ')}]` : ''
    log('info', `  • ${skill.name} v${skill.version}${tags}`)
    log('info', `    ${skill.description}`)
  }
}

/**
 * Show skill details
 */
async function showSkill(name: string): Promise<void> {
  const dirs = getSkillsDirs()
  const skill = await getSkill(name, dirs)
  
  if (!skill) {
    log('error', `Skill not found: ${name}`)
    return
  }
  
  log('info', `${skill.name} v${skill.version}`)
  log('info', `Description: ${skill.description}`)
  log('info', `Author: ${skill.author || 'Unknown'}`)
  log('info', `Tags: ${skill.tags?.join(', ') || 'None'}`)
  log('info', `Tools: ${skill.tools?.join(', ') || 'None'}`)
  log('info', `Entrypoint: ${skill.entrypoint}`)
}

/**
 * Execute skills command
 */
export default async function skillsCommand(args: string[]): Promise<void> {
  const subcommand = args[0] || 'list'
  
  try {
    switch (subcommand) {
      case 'list':
      case 'ls':
        await listSkills()
        break
        
      case 'show':
      case 'info': {
        const name = args[1]
        if (!name) {
          log('error', 'Please provide a skill name')
          return
        }
        await showSkill(name)
        break
      }
      
      case 'search': {
        const query = args.slice(1).join(' ')
        if (!query) {
          log('error', 'Please provide a search query')
          return
        }
        const dirs = getSkillsDirs()
        const results = await searchSkills(query, dirs)
        if (results.length === 0) {
          log('info', 'No skills found')
          return
        }
        log('info', `Found ${results.length} skills:`)
        for (const skill of results) {
          log('info', `  • ${skill.name} - ${skill.description}`)
        }
        break
      }
      
      case 'install': {
        const source = args[1]
        if (!source) {
          log('error', 'Please provide a skill source (path or URL)')
          return
        }
        const targetDir = join(homedir(), '.config', 'gizzi', 'skills')
        await installSkill(source, targetDir)
        break
      }
      
      case 'uninstall':
      case 'remove': {
        const name = args[1]
        if (!name) {
          log('error', 'Please provide a skill name')
          return
        }
        const dirs = getSkillsDirs()
        await uninstallSkill(name, dirs)
        break
      }
      
      case 'refresh':
      case 'reload': {
        clearSkillIndexCache()
        log('success', 'Skill cache cleared')
        break
      }
      
      default:
        log('error', `Unknown subcommand: ${subcommand}`)
        log('info', 'Available: list, show, search, install, uninstall, refresh')
    }
  } catch (error) {
    if (error instanceof Error) {
      log('error', `Skills command failed: ${error.message}`)
    } else {
      log('error', 'Skills command failed with unknown error')
    }
  }
}

export { listSkills, showSkill, getSkillsDirs }
