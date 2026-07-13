import { eq } from "drizzle-orm"
import { Database } from "@/runtime/session/storage/db"
import { GoalTable } from "@/runtime/session/session.sql"

export interface Milestone {
  name: string
  status: "pending" | "in_progress" | "completed" | "failed"
  completedAt?: string
}

export interface ValidationResult {
  testName: string
  status: "passed" | "failed"
  output?: string
}

export interface GoalTransitionResult {
  ok: boolean
  state?: string
  progress?: number
  reason?: string
}

/**
 * Owns durable goal lifecycle state.
 *
 * Agent execution is intentionally not simulated here. The orchestrator records
 * milestones and validation evidence through the goal update API as real work is
 * performed. This engine only performs atomic lifecycle transitions.
 */
export class GoalEngine {
  static async startGoal(id: string): Promise<void> {
    const goal = Database.use((db) =>
      db.select().from(GoalTable).where(eq(GoalTable.id, id)).get()
    )
    if (!goal || !["planning", "paused", "blocked", "failed"].includes(goal.state)) return

    const milestones: Milestone[] = goal.milestones.length > 0
      ? goal.milestones as Milestone[]
      : [{ name: "Plan the objective and publish milestones", status: "in_progress" }]

    Database.use((db) =>
      db.update(GoalTable).set({
        milestones,
        state: "in_progress",
        time_updated: Date.now(),
      }).where(eq(GoalTable.id, id)).run()
    )
  }

  static async pauseGoal(id: string): Promise<void> {
    this.setState(id, "paused")
  }

  static async blockGoal(id: string): Promise<void> {
    this.setState(id, "blocked")
  }

  static async recordMilestone(id: string, milestone: Milestone): Promise<GoalTransitionResult> {
    const goal = Database.use((db) =>
      db.select().from(GoalTable).where(eq(GoalTable.id, id)).get()
    )
    if (!goal) return { ok: false, reason: "Goal not found" }
    if (["completed"].includes(goal.state)) return { ok: false, reason: "Completed goals are immutable" }

    const normalized = milestone.status === "completed" && !milestone.completedAt
      ? { ...milestone, completedAt: new Date().toISOString() }
      : milestone
    const existingIndex = goal.milestones.findIndex((item) => item.name === milestone.name)
    const milestones = [...goal.milestones]
    if (existingIndex >= 0) milestones[existingIndex] = normalized
    else milestones.push(normalized)

    const completed = milestones.filter((item) => item.status === "completed").length
    const progress = milestones.length === 0 ? 0 : Math.round((completed / milestones.length) * 100)
    const state = milestone.status === "failed" ? "failed" : "in_progress"
    Database.use((db) =>
      db.update(GoalTable).set({
        milestones,
        state,
        progress,
        time_updated: Date.now(),
      }).where(eq(GoalTable.id, id)).run()
    )
    return { ok: true, state, progress }
  }

  static async recordValidation(id: string, validation: ValidationResult): Promise<GoalTransitionResult> {
    const goal = Database.use((db) =>
      db.select().from(GoalTable).where(eq(GoalTable.id, id)).get()
    )
    if (!goal) return { ok: false, reason: "Goal not found" }
    if (goal.state === "completed") return { ok: false, reason: "Completed goals are immutable" }

    const existingIndex = goal.validations.findIndex((item) => item.testName === validation.testName)
    const validations = [...goal.validations]
    if (existingIndex >= 0) validations[existingIndex] = validation
    else validations.push(validation)
    const state = validation.status === "failed" ? "failed" : "validating"
    Database.use((db) =>
      db.update(GoalTable).set({ validations, state, time_updated: Date.now() }).where(eq(GoalTable.id, id)).run()
    )
    return { ok: true, state, progress: goal.progress }
  }

  static async completeGoal(id: string): Promise<GoalTransitionResult> {
    const goal = Database.use((db) =>
      db.select().from(GoalTable).where(eq(GoalTable.id, id)).get()
    )
    if (!goal) return { ok: false, reason: "Goal not found" }
    if (goal.milestones.length === 0) return { ok: false, reason: "Goal has no completion milestones" }
    if (goal.milestones.some((milestone) => milestone.status !== "completed")) {
      return { ok: false, reason: "All milestones must be completed first" }
    }
    if (goal.validations.some((validation) => validation.status === "failed")) {
      return { ok: false, reason: "Failed validation evidence must be resolved first" }
    }
    Database.use((db) =>
      db.update(GoalTable).set({
        state: "completed",
        progress: 100,
        time_updated: Date.now(),
      }).where(eq(GoalTable.id, id)).run()
    )
    return { ok: true, state: "completed", progress: 100 }
  }

  private static setState(id: string, state: string): void {
    Database.use((db) =>
      db.update(GoalTable).set({ state, time_updated: Date.now() }).where(eq(GoalTable.id, id)).run()
    )
  }
}
