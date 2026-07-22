import z from "zod/v4"
import { Tool } from "@/runtime/tools/builtins/tool"
import { SkillGrowth } from "@/runtime/skills/growth"

export const SkillProposeTool = Tool.define("skill_propose", {
  description: "Create an inert, versioned skill proposal. This does not activate the skill.",
  parameters: z.object({
    name: z.string(),
    description: z.string(),
    content: z.string(),
    scope: z.enum(["user", "project"]).default("project"),
  }),
  async execute(params, ctx) {
    await ctx.ask({ permission: "skill_manage", patterns: [`propose:${params.scope}:${params.name}`], always: [], metadata: {} })
    const record = await SkillGrowth.propose(params)
    return { title: `Proposed ${record.name}`, metadata: { id: record.id, status: record.status }, output: JSON.stringify(record, null, 2) }
  },
})

export const SkillEvaluateTool = Tool.define("skill_evaluate", {
  description: "Attach a reproducible evaluation score and report to an inert skill proposal.",
  parameters: z.object({ proposal_id: z.string(), score: z.number().min(0).max(1), report: z.string() }),
  async execute(params) {
    const record = await SkillGrowth.evaluate(params.proposal_id, { score: params.score, report: params.report })
    return { title: `Evaluated ${record.name}`, metadata: { id: record.id, status: record.status, score: record.score }, output: JSON.stringify(record, null, 2) }
  },
})

export const SkillDecideTool = Tool.define("skill_decide", {
  description: "Approve or reject an evaluated skill proposal. Approval still does not activate it.",
  parameters: z.object({ proposal_id: z.string(), decision: z.enum(["approve", "reject"]) }),
  async execute(params, ctx) {
    await ctx.ask({ permission: "skill_manage", patterns: [`${params.decision}:${params.proposal_id}`], always: [], metadata: {} })
    const record = await SkillGrowth.decide(params.proposal_id, params.decision)
    return { title: `${params.decision}d ${record.name}`, metadata: { id: record.id, status: record.status }, output: JSON.stringify(record, null, 2) }
  },
})

export const SkillActivateTool = Tool.define("skill_activate", {
  description: "Activate an approved skill version, preserving the previous target for rollback.",
  parameters: z.object({ proposal_id: z.string() }),
  async execute(params, ctx) {
    await ctx.ask({ permission: "skill_manage", patterns: [`activate:${params.proposal_id}`], always: [], metadata: {} })
    const record = await SkillGrowth.activate(params.proposal_id)
    return { title: `Activated ${record.name}`, metadata: { id: record.id, status: record.status, target: record.target }, output: JSON.stringify(record, null, 2) }
  },
})

export const SkillRollbackTool = Tool.define("skill_rollback", {
  description: "Roll back an activated skill if its target has not been modified since activation.",
  parameters: z.object({ proposal_id: z.string() }),
  async execute(params, ctx) {
    await ctx.ask({ permission: "skill_manage", patterns: [`rollback:${params.proposal_id}`], always: [], metadata: {} })
    const record = await SkillGrowth.rollback(params.proposal_id)
    return { title: `Rolled back ${record.name}`, metadata: { id: record.id, status: record.status }, output: JSON.stringify(record, null, 2) }
  },
})
