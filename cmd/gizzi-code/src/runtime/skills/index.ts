// @ts-nocheck
// skill.ts exposes a single `Skill` namespace (Skill.Info, Skill.all(), ...) —
// the named members are not top-level exports, so only the namespace can be
// re-exported here.
export { Skill } from "@/runtime/skills/skill";
export { SkillCreator } from "@/runtime/skills/creator";
export type { CreateSkillOptions, CreationStep, SkillCreationSession, SkillExample, SkillTemplate } from "@/runtime/skills/creator";
export { createSkillFromGenerated, createSkillWithAI, generateInterviewQuestions, generateSkill } from "@/runtime/skills/skill-generator";
export type { GeneratedSkill, SkillGenerationInput } from "@/runtime/skills/skill-generator";
export { SkillCreatorTool, SkillCreatorToolDefinition, skillCreator } from "@/runtime/skills/creator-tool";
export type { SkillCreatorToolInput, SkillCreatorToolOutput } from "@/runtime/skills/creator-tool";

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
