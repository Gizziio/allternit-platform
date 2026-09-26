// §A2 — static router stub. Real routing (lanes, pools, cooldowns, circuit
// breaker) lands in P4; until then no adapter is ever eligible.
import { randomUUID } from "node:crypto";
import type {
  CapabilityRouter,
  FabricSnapshot,
  RouteDecision,
  Task,
  TaskAttempt,
} from "@allternit/subscription-fabric-contracts";

export class StaticRouter implements CapabilityRouter {
  resolve(_task: Task, _snapshot: FabricSnapshot): RouteDecision {
    return {
      decision_id: randomUUID(),
      primary: null,
      fallbacks: [],
      rejected: [{ adapter_id: "*", reason: "capability_not_offered" }],
      policy_version: "p1-static",
      explain: "no adapters registered (router lands in P4)",
    };
  }

  onAttemptFailed(
    _task: Task,
    _attempt: TaskAttempt,
    _snapshot: FabricSnapshot
  ): RouteDecision | "stop" {
    return "stop";
  }
}
