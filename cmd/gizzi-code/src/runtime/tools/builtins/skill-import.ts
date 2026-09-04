import z from "zod/v4"
import { Tool } from "@/runtime/tools/builtins/tool"
import { SkillImporter } from "@/runtime/skills/importer"

export const SkillImportPreviewTool = Tool.define("skill_import_preview", {
  description: "Build a read-only gizzi-code/Codex import plan with exact paths, collisions, and compatibility warnings.",
  parameters: z.object({
    categories: z.array(z.enum(["instructions", "skills", "mcp"])).min(1),
  }),
  async execute(params) {
    const plan = await SkillImporter.preview(params.categories)
    return { title: "Skill import preview", metadata: { planID: plan.id, operations: plan.operations.length }, output: JSON.stringify(plan, null, 2) }
  },
})

export const SkillImportApplyTool = Tool.define("skill_import_apply", {
  description: "Apply a previously previewed import plan. MCP entries remain review-only and are never started or written by this tool.",
  parameters: z.object({ plan_id: z.string() }),
  async execute(params, ctx) {
    const plan = await SkillImporter.get(params.plan_id)
    if (!plan) throw new Error(`Import plan ${params.plan_id} not found`)
    await ctx.ask({
      permission: "skill_manage",
      patterns: [`import:${plan.id}`],
      always: [],
      metadata: { operations: plan.operations.filter((item) => item.status === "ready").map((item) => ({ source: item.source, target: item.target })) },
    })
    const applied = await SkillImporter.apply(plan.id)
    return { title: "Skill import applied", metadata: { planID: applied.id, appliedAt: applied.appliedAt }, output: JSON.stringify(applied, null, 2) }
  },
})
