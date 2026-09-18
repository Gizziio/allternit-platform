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

// TODO(types): the Skill namespace has no Skill/SkillDefinition members — local
// mirrors of Skill.Info (skill.ts is the source of truth)
type SkillRecord = Skill.Info
type SkillDefinition = Skill.Info

export function createSkill(def: SkillDefinition): SkillRecord {
  return def as unknown as SkillRecord
}

export function listSkills(): SkillRecord[] {
  return []
}

export function getSkill(name: string): SkillRecord | undefined {
  return undefined
}
