import { HookDispatcher } from "@/runtime/hooks/dispatcher";
import { Turn, type TurnOptions } from "./turn";
import { Log } from "@/shared/util/log";
import { StopCondition } from "./stop";
import { BudgetManager } from "./budget";

export class AgentLoop {
  private log = Log.create({ service: "runtime.loop" });
  private done = false;
  private budget = new BudgetManager();
  private turnCount = 0;
  private recentPlanHashes: string[] = [];
  private sessionId: string;
  private options: TurnOptions;

  constructor(
    sessionId: string,
    options: TurnOptions = {}
  ) {
    this.sessionId = sessionId;
    this.options = options;
  }

  async start() {
    this.log.info("Starting production agent loop", { sessionId: this.sessionId });

    await HookDispatcher.emit({
      name: "SessionStart",
      timestamp: Date.now(),
      sessionId: this.sessionId,
      payload: { budget: this.budget.getSnapshot() }
    });

    try {
      while (!this.done) {
        // 1. Check stop conditions (budget, max turns, loops)
        const stopReason = await StopCondition.check(
          this.sessionId, 
          this.budget, 
          this.turnCount, 
          this.recentPlanHashes
        );

        if (stopReason) {
          this.log.info("Agent loop stopping", { reason: stopReason });
          this.done = true;
          break;
        }

        // 2. Execute a single turn
        const turn = new Turn(this.sessionId, this.budget, this.options);
        const result = await turn.execute();
        this.turnCount++;

        // 3. Record plan hash for loop detection
        const planHash = (result as any).planHash;
        if (planHash) {
          this.recentPlanHashes.push(planHash);
          if (this.recentPlanHashes.length > 5) this.recentPlanHashes.shift();
        }

        if (result.status === "completed") {
          this.log.info("Task completed successfully");
          this.done = true;
        } else if (result.status === "failed") {
          this.log.error("Task failed", { error: result.error });
          this.done = true;
        }
      }
    } finally {
      await HookDispatcher.emit({
        name: "SessionEnd",
        timestamp: Date.now(),
        sessionId: this.sessionId,
        payload: { 
          finalBudget: this.budget.getSnapshot(),
          turnsExecuted: this.turnCount
        }
      });
    }
  }

  stop() {
    this.done = true;
  }
}
