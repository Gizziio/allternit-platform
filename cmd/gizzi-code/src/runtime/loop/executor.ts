import { ToolDispatcher } from "@/runtime/tools/dispatch";
import { ToolRegistry } from "@/runtime/tools/builtins/registry";
import { Log } from "@/shared/util/log";
import { Plan, PlanStep } from "./planner";
import { BudgetManager } from "./budget";

export interface ExecutionReceipt {
  stepId: string;
  toolId: string;
  success: boolean;
  output: any;
  durationMs: number;
  metadata?: any;
}

export class Executor {
  private log = Log.create({ service: "runtime.executor" });

  constructor(
    private sessionId: string,
    private budget: BudgetManager
  ) {}

  async run(plan: Plan): Promise<ExecutionReceipt[]> {
    this.log.info("Executing plan", { sessionId: this.sessionId, stepCount: plan.steps.length });
    const receipts: ExecutionReceipt[] = [];

    for (const step of plan.steps) {
      this.log.debug("Executing step", { stepId: step.id, toolId: step.toolId });
      const startTime = Date.now();

      const tools = await ToolRegistry.tools({ providerID: "gizzi", modelID: "sonnet" });
      const tool = tools.find(t => t.id === step.toolId);

      if (!tool) {
        receipts.push({
          stepId: step.id,
          toolId: step.toolId,
          success: false,
          output: `Tool "${step.toolId}" not found`,
          durationMs: Date.now() - startTime
        });
        break; // Stop execution on fatal missing tool
      }

      try {
        const result = await ToolDispatcher.execute(tool as any, step.args, {
          sessionID: this.sessionId,
          messageID: "system",
          agent: "gizzi-executor",
          abort: new AbortController().signal,
          messages: [],
          metadata: () => {},
          ask: async () => {}
        });

        this.budget.recordToolCall();
        if (result.metadata?.tokens) {
          this.budget.recordUsage(result.metadata.tokens);
        }

        const denied = !!result.metadata?.denied;
        receipts.push({
          stepId: step.id,
          toolId: step.toolId,
          success: !denied,
          output: result.output,
          metadata: result.metadata,
          durationMs: Date.now() - startTime
        });

        if (denied) {
          this.log.warn("Step execution denied, halting plan", { stepId: step.id });
          break; // Halt on security denial
        }
      } catch (error) {
        this.log.error("Step execution failed", { stepId: step.id, error });
        receipts.push({
          stepId: step.id,
          toolId: step.toolId,
          success: false,
          output: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime
        });
        break; // Halt on execution failure
      }
    }

    return receipts;
  }
}
