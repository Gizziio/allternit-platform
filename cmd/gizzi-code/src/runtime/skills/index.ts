// @ts-nocheck
export * from "@/runtime/skills/skill"
export * from "@/runtime/skills/creator"
export * from "@/runtime/skills/skill-generator"
export * from "@/runtime/skills/creator-tool"

import type { Skill } from "@/runtime/skills/skill"

export function createSkill(def: Skill.SkillDefinition): Skill.Skill {
  return def as unknown as Skill.Skill
}

export function listSkills(): Skill.Skill[] {
  return []
}

export function getSkill(name: string): Skill.Skill | undefined {
  return undefined
}
