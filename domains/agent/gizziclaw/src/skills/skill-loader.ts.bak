/**
 * GizziClaw Skill Loader
 * Ported from OpenCLAW src/agents/skills.*
 * 
 * Loads and manages skills in agent workspaces.
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';

/**
 * Skill manifest schema
 */
export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  dependencies?: string[];
  capabilities?: string[];
}

/**
 * Load skill manifest
 */
export async function loadSkillManifest(skillDir: string): Promise<SkillManifest> {
  const manifestPath = path.join(skillDir, 'SKILL.md');
  const content = await fs.readFile(manifestPath, 'utf-8');
  
  // Parse SKILL.md frontmatter
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new Error(`Invalid skill manifest: ${manifestPath}`);
  }
  
  const frontmatter = match[1];
  const manifest: Partial<SkillManifest> = {};
  
  for (const line of frontmatter.split('\n')) {
    const [key, value] = line.split(':').map(s => s.trim());
    if (key && value) {
      const parsedValue = value.replace(/^["']|["']$/g, '');
      if (key === 'dependencies') {
        manifest.dependencies = parsedValue.split(',').map(s => s.trim());
      } else if (key === 'capabilities') {
        manifest.capabilities = parsedValue.split(',').map(s => s.trim());
      } else {
        (manifest as any)[key] = parsedValue;
      }
    }
  }
  
  return manifest as SkillManifest;
}

/**
 * Load all skills from directory
 */
export async function loadSkills(skillsDir: string): Promise<SkillManifest[]> {
  const skills: SkillManifest[] = [];
  
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillDir = path.join(skillsDir, entry.name);
        try {
          const manifest = await loadSkillManifest(skillDir);
          skills.push(manifest);
          console.log(`Loaded skill: ${manifest.name} v${manifest.version}`);
        } catch (error) {
          console.warn(`Failed to load skill ${entry.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn(`Skills directory not found: ${skillsDir}`);
  }
  
  return skills;
}

/**
 * Install skill to workspace
 */
export async function installSkill(
  workspaceRoot: string,
  skillSource: string,
  skillName: string
): Promise<void> {
  const skillDest = path.join(workspaceRoot, 'skills', skillName);
  
  await fs.mkdir(skillDest, { recursive: true });
  await fs.cp(skillSource, skillDest, { recursive: true });
  
  console.log(`Installed skill: ${skillName}`);
}

/**
 * Uninstall skill from workspace
 */
export async function uninstallSkill(
  workspaceRoot: string,
  skillName: string
): Promise<void> {
  const skillDir = path.join(workspaceRoot, 'skills', skillName);
  await fs.rm(skillDir, { recursive: true, force: true });
  
  console.log(`Uninstalled skill: ${skillName}`);
}

export default {
  loadSkillManifest,
  loadSkills,
  installSkill,
  uninstallSkill,
};
