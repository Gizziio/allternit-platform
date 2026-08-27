import { Tool } from "./builtins/tool";
import { HookDispatcher } from "@/runtime/hooks/dispatcher";
import { Log } from "@/shared/util/log";
import { checkToolHardBan, formatHardBanDenial } from "@/shared/utils/agentHardBans";

export namespace ToolDispatcher {
  const log = Log.create({ service: "tool.dispatcher" });

  export async function execute(
    tool: Tool.Info,
    args: any,
    ctx: Tool.Context
  ): Promise<any> {
    const initialized = await tool.init()
    return executeInitialized(tool.id, args, ctx, initialized.execute)
  }

  export async function executeInitialized<T>(
    toolID: string,
    args: any,
    ctx: Tool.Context,
    execute: (args: any, ctx: Tool.Context) => Promise<T>,
  ): Promise<T> {
    const sessionId = ctx.sessionID;

    // 0. Dispatch-time hard-ban guard: the active agent's character-card hard
    // bans (ALLTERNIT_AGENT_HARD_BANS) block banned tool calls (e.g.
    // email_send → send_agent_email, gmail.send_email, allternit_mail.send)
    // before hooks or execution. See src/shared/utils/agentHardBans.ts.
    const banViolation = checkToolHardBan(toolID, args)
    if (banViolation) {
      log.warn("Tool call blocked by agent hard ban", { toolId: toolID, category: banViolation.category, matched: banViolation.matched });
      const denied = {
        title: "Blocked by agent policy",
        output: formatHardBanDenial(banViolation),
        metadata: { denied: true, policyViolation: banViolation }
      } as T;
      await HookDispatcher.emit({
        name: "PostToolUseFailure",
        timestamp: Date.now(),
        sessionId,
        payload: { tool: toolID, args, reason: banViolation.reason, blocked: true },
      })
      return denied
    }

    // 1. Emit PreToolUse Hook
    const hookRes = await HookDispatcher.emit({
      name: "PreToolUse",
      timestamp: Date.now(),
      sessionId,
      payload: { tool: toolID, args, context: ctx }
    });

    if (hookRes.decision === "deny") {
      log.warn("Tool usage denied by hook", { toolId: toolID, reason: hookRes.reason });
      const denied = {
        title: "Access Denied",
        output: `Tool usage was denied by a security policy: ${hookRes.reason || "No reason provided."}`,
        metadata: { denied: true }
      } as T;
      await HookDispatcher.emit({
        name: "PostToolUseFailure",
        timestamp: Date.now(),
        sessionId,
        payload: { tool: toolID, args, reason: hookRes.reason, blocked: true },
      })
      return denied
    }

    if (hookRes.modifiedPayload) {
      args = hookRes.modifiedPayload.args ?? hookRes.modifiedPayload;
    }

    try {
      const result = await execute(args, ctx);

      // 3. Emit PostToolUse Hook
      await HookDispatcher.emit({
        name: "PostToolUse",
        timestamp: Date.now(),
        sessionId,
        payload: { tool: toolID, args, result }
      });

      return result;
    } catch (error) {
      log.error("Tool execution failed", { toolId: toolID, error });

      // 4. Emit ToolError Hook
      await HookDispatcher.emit({
        name: "PostToolUseFailure",
        timestamp: Date.now(),
        sessionId,
        payload: { tool: toolID, args, error }
      });

      throw error;
    }
  }
}
