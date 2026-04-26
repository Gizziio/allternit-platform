/**
 * Workspace-scoped team skills loader.
 *
 * Fetches TeamSkill records from the platform API for the active workspace
 * and registers each as a bundled skill. Called at startup after the
 * workspace context is known.
 *
 * If the platform API is not reachable this is a silent no-op — gizzi still
 * works, workspace skills are just absent.
 */

import { registerBundledSkill } from '../bundledSkills.js'

const PLATFORM_BASE =
  process.env.ALLTERNIT_PLATFORM_URL || 'http://localhost:3000'

interface TeamSkillRecord {
  id: string
  name: string
  description?: string
  manifest?: string
  version: string
}

interface SkillManifest {
  prompt?: string
  argumentHint?: string
  whenToUse?: string
  model?: string
  allowedTools?: string[]
}

async function fetchWorkspaceSkills(workspaceId: string): Promise<TeamSkillRecord[]> {
  const token =
    process.env.ALLTERNIT_SESSION_TOKEN || process.env.ALLTERNIT_API_TOKEN
  const url = `${PLATFORM_BASE}/api/v1/team-skills?workspaceId=${encodeURIComponent(workspaceId)}`

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) })
  if (!res.ok) return []

  const data = (await res.json()) as { skills?: TeamSkillRecord[] }
  return data.skills ?? []
}

function parseManifest(raw?: string): SkillManifest {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as SkillManifest
  } catch {
    return {}
  }
}

/**
 * Fetches workspace skills from the platform and registers each as a
 * bundled skill. Call this once at startup with the active workspace ID.
 * Safe to call multiple times (re-registration is idempotent via name).
 */
export async function registerWorkspaceSkills(workspaceId: string): Promise<void> {
  let skills: TeamSkillRecord[]
  try {
    skills = await fetchWorkspaceSkills(workspaceId)
  } catch {
    return
  }

  for (const skill of skills) {
    const manifest = parseManifest(skill.manifest)
    const skillName = `team:${skill.name.toLowerCase().replace(/\s+/g, '-')}`
    const prompt =
      manifest.prompt ??
      `You are helping the user with a workspace task. Skill: ${skill.name}.\n\n${skill.description ?? 'No description provided.'}\n\n`

    registerBundledSkill({
      name: skillName,
      description: skill.description ?? skill.name,
      argumentHint: manifest.argumentHint,
      whenToUse: manifest.whenToUse,
      model: manifest.model,
      allowedTools: manifest.allowedTools,
      userInvocable: true,
      async getPromptForCommand(args) {
        const text = args ? `${prompt}\n## User Request\n\n${args}` : prompt
        return [{ type: 'text', text }]
      },
    })
  }
}
