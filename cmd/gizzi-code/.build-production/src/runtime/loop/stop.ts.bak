import { BudgetManager } from "./budget";
import { Log } from "@/shared/util/log";

export type StopReason = 
  | "budget_exceeded" 
  | "user_interrupted" 
  | "policy_violation" 
  | "max_turns_reached"
  | "loop_detected";

export namespace StopCondition {
  const log = Log.create({ service: "runtime.stop" });
  const MAX_TURNS = 50;

  export async function check(
    sessionId: string, 
    budget: BudgetManager, 
    turnCount: number,
    recentPlanHashes: string[]
  ): Promise<StopReason | null> {
    // 1. Budget check
    if (budget.isExceeded()) {
      log.warn("Stopping: Budget exceeded", { sessionId });
      return "budget_exceeded";
    }

    // 2. Turn count check
    if (turnCount >= MAX_TURNS) {
      log.warn("Stopping: Max turns reached", { sessionId, turnCount });
      return "max_turns_reached";
    }

    // 3. Loop detection (Simple heuristic: same plan generated 3 times in a row)
    if (recentPlanHashes.length >= 3) {
      const last = recentPlanHashes[recentPlanHashes.length - 1];
      const allSame = recentPlanHashes.slice(-3).every(h => h === last);
      if (allSame) {
        log.error("Stopping: Loop detected", { sessionId, planHash: last });
        return "loop_detected";
      }
    }

    // 4. Policy check (Stub for now, would call GuardPolicy)
    
    return null;
  }
}
