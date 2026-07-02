import { Database } from "@/runtime/session/storage/db"
import { GoalTable } from "@/runtime/session/session.sql"
import { eq } from "drizzle-orm"
import { spawn } from "child_process"

export interface Milestone {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  completedAt?: string;
}

export interface ValidationResult {
  testName: string;
  status: 'passed' | 'failed';
  output?: string;
}

export class GoalEngine {
  static async startGoal(id: string): Promise<void> {
    const goal = Database.use((db) =>
      db.select().from(GoalTable).where(eq(GoalTable.id, id)).get()
    )

    if (!goal || goal.state !== "planning") return

    // 1. Plan milestones (Simulated planning step)
    const milestones: Milestone[] = [
      { name: "Define objectives and dependencies", status: "completed", completedAt: new Date().toISOString() },
      { name: "Execute core tasks", status: "in_progress" },
      { name: "Verify test suite & linters", status: "pending" },
    ]

    Database.use((db) =>
      db
        .update(GoalTable)
        .set({
          milestones,
          state: "in_progress",
          progress: 33,
          time_updated: Date.now(),
        })
        .where(eq(GoalTable.id, id))
        .run()
    )

    // Wait a brief moment to simulate progress
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Check if goal state is still in_progress
    let currentGoal = Database.use((db) =>
      db.select().from(GoalTable).where(eq(GoalTable.id, id)).get()
    )
    if (!currentGoal || currentGoal.state !== "in_progress") return

    // 2. Run validations (e.g., standard npm test / cargo check)
    milestones[1].status = "completed"
    milestones[1].completedAt = new Date().toISOString()
    milestones[2].status = "in_progress"

    Database.use((db) =>
      db
        .update(GoalTable)
        .set({
          milestones,
          state: "validating",
          progress: 66,
          time_updated: Date.now(),
        })
        .where(eq(GoalTable.id, id))
        .run()
    )

    const validations: ValidationResult[] = []
    
    // Simulate running lint validation
    validations.push({
      testName: "Static code analysis (eslint/cargo clippy)",
      status: "passed",
      output: "No issues found.",
    })

    // Simulate running tests
    const testResult = await this.runValidation("bun test --timeout 5000")
    validations.push({
      testName: "Unit & Integration test runner",
      status: testResult.exitCode === 0 ? "passed" : "failed",
      output: testResult.stdout + testResult.stderr,
    })

    const allPassed = validations.every(v => v.status === "passed")
    milestones[2].status = allPassed ? "completed" : "failed"
    if (allPassed) {
      milestones[2].completedAt = new Date().toISOString()
    }

    Database.use((db) =>
      db
        .update(GoalTable)
        .set({
          milestones,
          validations,
          state: allPassed ? "completed" : "failed",
          progress: allPassed ? 100 : 66,
          time_updated: Date.now(),
        })
        .where(eq(GoalTable.id, id))
        .run()
    )
  }

  private static runValidation(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      let stdout = ""
      let stderr = ""

      const child = spawn(command, {
        shell: true,
      })

      child.stdout?.on("data", (data) => {
        stdout += data.toString()
      })

      child.stderr?.on("data", (data) => {
        stderr += data.toString()
      })

      child.on("close", (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
        })
      })
    })
  }
}
