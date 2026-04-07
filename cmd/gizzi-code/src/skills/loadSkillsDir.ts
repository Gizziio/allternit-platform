/**
 * Skills Directory Loader
 * Production-quality skill loading from filesystem
 */

import { readdir, readFile, access, constants, stat } from 'fs/promises'
import { join, extname, basename } from 'path'
import { log } from '../utils/log.js'
import { glob } from '../runtime/util/filesystem.js'

export interface Skill {
  name: string
  version: string
  description: string
  author?: string
  tags: string[]
  tools: string[]
  entrypoint: string
  config?: Record<string, unknown>
}

export interface SkillModule {
  default?: Skill
  skill?: Skill
  [key: string]: unknown
}

// In-memory cache
let skillCache: Map<string, Skill> | null = null
let skillIndexCache: { timestamp: number; skills: Skill[] } | null = null

/**
 * Load a single skill from file
 */
async function loadSkillFile(filePath: string): Promise<Skill | null> {
  try {
    const ext = extname(filePath)
    
    if (ext === '.json') {
      // JSON skill definition
      const content = await readFile(filePath, 'utf8')
      const skill: Skill = JSON.parse(content)
      return validateSkill(skill) ? skill : null
    }
    
    if (ext === '.ts' || ext === '.js') {
      // TypeScript/JavaScript skill module
      const module = await import(filePath)
      const skill = module.default || module.skill
      if (skill && validateSkill(skill)) {
        return skill
      }
    }
    
    return null
  } catch (error) {
    log('error', `Failed to load skill from ${filePath}:`, error)
    return null
  }
}

/**
 * Validate skill structure
 */
function validateSkill(skill: unknown): skill is Skill {
  if (typeof skill !== 'object' || skill === null) return false
  
  const s = skill as Skill
  return (
    typeof s.name === 'string' &&
    s.name.length > 0 &&
    typeof s.version === 'string' &&
    typeof s.description === 'string' &&
    Array.isArray(s.tools) &&
    typeof s.entrypoint === 'string'
  )
}

/**
 * Load skills from directory
 */
export async function loadSkillsDir(dir: string): Promise<Skill[]> {
  const skills: Skill[] = []
  
  try {
    // Check if directory exists
    await access(dir, constants.F_OK)
  } catch {
    log('debug', `Skills directory not found: ${dir}`)
    return skills
  }
  
  try {
    // Find all skill files
    const files = await readdir(dir)
    
    for (const file of files) {
      const filePath = join(dir, file)
      const fileStat = await stat(filePath)
      
      if (fileStat.isDirectory()) {
        // Look for index.ts or skill.json in subdirectory
        const indexPath = join(filePath, 'index.ts')
        const jsonPath = join(filePath, 'skill.json')
        
        try {
          await access(indexPath, constants.F_OK)
          const skill = await loadSkillFile(indexPath)
          if (skill) {
            skill.name = skill.name || file
            skills.push(skill)
          }
        } catch {
          try {
            await access(jsonPath, constants.F_OK)
            const skill = await loadSkillFile(jsonPath)
            if (skill) {
              skill.name = skill.name || file
              skills.push(skill)
            }
          } catch {
            // No skill found in directory
          }
        }
      } else if (file.endsWith('.skill.ts') || file.endsWith('.skill.js') || file === 'skill.json') {
        const skill = await loadSkillFile(filePath)
        if (skill) {
          skills.push(skill)
        }
      }
    }
  } catch (error) {
    log('error', `Failed to load skills from ${dir}:`, error)
  }
  
  return skills
}

/**
 * Load all skills from multiple directories
 */
export async function loadAllSkills(dirs: string[]): Promise<Skill[]> {
  const allSkills: Skill[] = []
  const seen = new Set<string>()
  
  for (const dir of dirs) {
    const skills = await loadSkillsDir(dir)
    for (const skill of skills) {
      if (!seen.has(skill.name)) {
        seen.add(skill.name)
        allSkills.push(skill)
      }
    }
  }
  
  return allSkills
}

/**
 * Get skill by name
 */
export async function getSkill(name: string, dirs: string[]): Promise<Skill | null> {
  // Check cache first
  if (skillCache?.has(name)) {
    return skillCache.get(name)!
  }
  
  // Load and cache
  const skills = await loadAllSkills(dirs)
  skillCache = new Map(skills.map(s => [s.name, s]))
  
  return skillCache.get(name) || null
}

/**
 * Search skills by tag or description
 */
export async function searchSkills(query: string, dirs: string[]): Promise<Skill[]> {
  const skills = await loadAllSkills(dirs)
  const lowerQuery = query.toLowerCase()
  
  return skills.filter(skill => {
    return (
      skill.name.toLowerCase().includes(lowerQuery) ||
      skill.description.toLowerCase().includes(lowerQuery) ||
      skill.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  })
}

/**
 * Get skills by tag
 */
export async function getSkillsByTag(tag: string, dirs: string[]): Promise<Skill[]> {
  const skills = await loadAllSkills(dirs)
  return skills.filter(skill => skill.tags?.includes(tag))
}

/**
 * Clear skill cache
 */
export function clearSkillIndexCache(): void {
  skillCache = null
  skillIndexCache = null
  log('debug', 'Skill cache cleared')
}

/**
 * Build skill index for faster lookup
 */
export async function buildSkillIndex(dirs: string[]): Promise<{ skills: Skill[]; timestamp: number }> {
  if (skillIndexCache && Date.now() - skillIndexCache.timestamp < 60000) {
    return skillIndexCache
  }
  
  const skills = await loadAllSkills(dirs)
  skillIndexCache = { skills, timestamp: Date.now() }
  
  return skillIndexCache
}

/**
 * Install a skill from a URL or path
 */
export async function installSkill(source: string, targetDir: string): Promise<Skill | null> {
  try {
    // For now, just copy from local path
    // In production, this would support git URLs, npm packages, etc.
    log('info', `Installing skill from ${source}...`)
    
    const skill = await loadSkillFile(source)
    if (!skill) {
      throw new Error('Invalid skill file')
    }
    
    // Copy to target directory
    const targetPath = join(targetDir, `${skill.name}.skill.json`)
    await import('fs/promises').then(fs => fs.writeFile(targetPath, JSON.stringify(skill, null, 2)))
    
    log('success', `Installed skill: ${skill.name}`)
    clearSkillIndexCache()
    
    return skill
  } catch (error) {
    log('error', `Failed to install skill from ${source}:`, error)
    return null
  }
}

/**
 * Uninstall a skill
 */
export async function uninstallSkill(name: string, dirs: string[]): Promise<boolean> {
  for (const dir of dirs) {
    const paths = [
      join(dir, `${name}.skill.ts`),
      join(dir, `${name}.skill.js`),
      join(dir, `${name}.skill.json`),
      join(dir, name, 'index.ts'),
      join(dir, name, 'skill.json'),
    ]
    
    for (const filePath of paths) {
      try {
        await access(filePath, constants.F_OK)
        await import('fs/promises').then(fs => fs.unlink(filePath))
        log('success', `Uninstalled skill: ${name}`)
        clearSkillIndexCache()
        return true
      } catch {
        // File doesn't exist, continue
      }
    }
  }
  
  log('error', `Skill not found: ${name}`)
  return false
}

export default {
  loadSkillsDir,
  loadAllSkills,
  getSkill,
  searchSkills,
  getSkillsByTag,
  clearSkillIndexCache,
  buildSkillIndex,
  installSkill,
  uninstallSkill,
}
