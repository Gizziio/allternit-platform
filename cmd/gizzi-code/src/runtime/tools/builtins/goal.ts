import z from "zod/v4"
import { GoalEngine, type Milestone } from "@/runtime/automation/goal-engine"
import { Tool } from "@/runtime/tools/builtins/tool"

function resolveGoal(goalID: string | undefined, sessionID: string) {
  GoalEngine.initialize()
  return goalID ? GoalEngine.getGoal(goalID) : GoalEngine.getCurrentGoal(sessionID)
}

function result(title: string, value: unknown) {
  return {
    title,
    output: JSON.stringify(value, null, 2),
    metadata: {},
  }
}

export const CreateGoalTool = Tool.define("create_goal", {
  description: `Create one durable autonomous goal for this session.

Use only when the user explicitly asks for persistent autonomous work. A session may own one
active goal. Set replace=true only when the user explicitly replaces it; set enqueue=true to keep
the new goal dormant until the active goal completes. Hard budgets are enforced at continuation
turn boundaries.`,
  parameters: z.object({
    objective: z.string().min(1).describe("Concrete objective to pursue"),
    completionCriterion: z.string().min(1).optional().describe("Observable evidence required for completion"),
    turnBudget: z.number().int().positive().optional(),
    tokenBudget: z.number().int().positive().optional(),
    wallClockBudgetMs: z.number().int().positive().optional(),
    replace: z.boolean().optional(),
    enqueue: z.boolean().optional(),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "goal_create",
      patterns: [params.objective],
      always: [],
      metadata: { objective: params.objective },
    })
    GoalEngine.initialize()
    const id = crypto.randomUUID()
    const transition = GoalEngine.createGoal({
      id,
      agentId: ctx.sessionID,
      objective: params.objective,
      completionCriterion: params.completionCriterion,
      budget: {
        turnBudget: params.turnBudget,
        tokenBudget: params.tokenBudget,
        wallClockBudgetMs: params.wallClockBudgetMs,
      },
      replace: params.replace,
      enqueue: params.enqueue,
    })
    return result(transition.ok ? `Goal ${transition.state}` : "Goal not created", {
      goalID: transition.ok ? id : undefined,
      ...transition,
    })
  },
})

export const GetGoalTool = Tool.define("get_goal", {
  description: "Read the current durable goal, its evidence, hard budgets, usage, queue state, and blocked audit.",
  parameters: z.object({
    goalID: z.string().optional().describe("Goal ID; omit to read this session's active goal"),
  }),
  async execute(params, ctx) {
    const goal = resolveGoal(params.goalID, ctx.sessionID)
    return result(goal ? `Goal ${goal.state}` : "No active goal", { goal: goal ?? null })
  },
})

export const SetGoalBudgetTool = Tool.define("set_goal_budget", {
  description: `Set or clear hard budgets on a durable goal.

Omitted fields remain unchanged. Pass null to clear a budget. Budget changes do not resume a
paused or blocked goal; resumption remains an explicit lifecycle action.`,
  parameters: z.object({
    goalID: z.string().optional(),
    turnBudget: z.number().int().positive().nullable().optional(),
    tokenBudget: z.number().int().positive().nullable().optional(),
    wallClockBudgetMs: z.number().int().positive().nullable().optional(),
  }),
  async execute(params, ctx) {
    const goal = resolveGoal(params.goalID, ctx.sessionID)
    if (!goal) return result("Goal not found", { ok: false, reason: "Goal not found" })
    await ctx.ask({
      permission: "goal_budget",
      patterns: [goal.id],
      always: [],
      metadata: { goalID: goal.id },
    })
    const transition = GoalEngine.setBudget(goal.id, {
      turnBudget: params.turnBudget,
      tokenBudget: params.tokenBudget,
      wallClockBudgetMs: params.wallClockBudgetMs,
    })
    return result(transition.ok ? "Goal budget updated" : "Goal budget rejected", transition)
  },
})

export const UpdateGoalTool = Tool.define("update_goal", {
  description: `Record a continuation turn or request a durable goal outcome.

Use progress after a continuation turn. Use complete only after every requested deliverable and
milestone has evidence; completion is rejected while milestones or validation failures remain.
Use blocked only for a concrete external impasse. The identical blocker must recur for three
consecutive goal turns before the engine marks the goal blocked.`,
  parameters: z.object({
    goalID: z.string().optional(),
    status: z.enum(["progress", "complete", "blocked", "paused", "resume"]),
    reason: z.string().min(1).optional(),
    tokensUsed: z.number().int().nonnegative().optional(),
    milestone: z.object({
      name: z.string().min(1),
      status: z.enum(["pending", "in_progress", "completed", "failed"]),
    }).optional(),
  }),
  async execute(params, ctx) {
    const goal = resolveGoal(params.goalID, ctx.sessionID)
    if (!goal) return result("Goal not found", { ok: false, reason: "Goal not found" })

    let milestoneTransition
    if (params.milestone) {
      milestoneTransition = GoalEngine.recordMilestone(goal.id, params.milestone as Milestone)
      if (!milestoneTransition.ok) return result("Goal milestone rejected", milestoneTransition)
    }

    if (params.status === "paused") {
      const transition = GoalEngine.pauseGoal(goal.id, params.reason ?? "Paused by agent at user request.")
      return result("Goal paused", { ...transition, milestone: milestoneTransition })
    }

    if (params.status === "resume") {
      const transition = GoalEngine.startGoal(goal.id)
      return result(transition.ok ? "Goal resumed" : "Goal resume rejected", {
        ...transition,
        milestone: milestoneTransition,
      })
    }

    if (params.status === "blocked" && !params.reason) {
      return result("Goal blocker rejected", {
        ok: false,
        reason: "A concrete blocker reason is required for the three-turn blocked audit.",
      })
    }

    const continuation = GoalEngine.recordContinuation(goal.id, {
      tokensUsed: params.tokensUsed,
      blocker: params.status === "blocked" ? params.reason : undefined,
    })
    if (!continuation.ok || continuation.state === "blocked") {
      return result(continuation.state === "blocked" ? "Goal blocked" : "Goal update rejected", {
        ...continuation,
        milestone: milestoneTransition,
      })
    }

    if (params.status !== "complete") {
      return result("Goal progress recorded", { ...continuation, milestone: milestoneTransition })
    }

    const completed = GoalEngine.completeGoal(goal.id, params.reason ?? "Completion evidence audited by agent.")
    return result(completed.ok ? "Goal completed" : "Goal completion rejected", {
      ...completed,
      milestone: milestoneTransition,
    })
  },
})
