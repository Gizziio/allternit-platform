import z from "zod/v4"
import { Tool } from "@/runtime/tools/builtins/tool"
import { Agent } from "@/runtime/loop/agent"
import { Session } from "@/runtime/session"
import { SessionPrompt } from "@/runtime/session/prompt"
import { MessageV2 } from "@/runtime/session/message-v2"
import { Config } from "@/runtime/context/config/config"
import { HookDispatcher } from "@/runtime/hooks/dispatcher"
import { PermissionNext } from "@/runtime/tools/guard/permission/next"
import {
  AdaptiveRunBatch,
  resolveAdaptiveConcurrency,
  type AdaptiveRunLauncher,
} from "@/runtime/agents/adaptive-run-batch"
import {
  assertOwnedSubagentRun,
  needsSubagentSummaryContinuation,
  throwIfSubagentMessageFailed,
} from "@/runtime/agents/subagent-run-contract"

const item = z.object({
  description: z.string().min(1),
  prompt: z.string().min(1),
  subagent_type: z.string().min(1),
  task_id: z.string().optional().describe("Owned child session to resume instead of spawning a new agent."),
  timeout_ms: z.number().int().positive().max(3_600_000).optional(),
})

const parameters = z.object({
  tasks: z.array(item).min(1).max(32),
  max_concurrency: z.number().int().positive().max(32).optional(),
})

type Item = z.infer<typeof item>

export const AgentSwarmTool = Tool.define("agent_swarm", async () => ({
  description:
    "Run a batch of independent subagents with adaptive burst/ramp scheduling, same-agent rate-limit retry, cancellation, and ordered partial results.",
  parameters,
  async execute(params, ctx) {
    const config = await Config.get()
    const parentMessage = await MessageV2.get({ sessionID: ctx.sessionID, messageID: ctx.messageID })
    if (parentMessage.info.role !== "assistant") throw new Error("Agent swarm must be called from an assistant turn")

    const resolved = new Map<string, Agent.Info>()
    for (const task of params.tasks) {
      await ctx.ask({
        permission: "task",
        patterns: [task.subagent_type],
        always: [task.subagent_type],
        metadata: { description: task.description, subagent_type: task.subagent_type, swarm: true },
      })
      const agent = await Agent.get(task.subagent_type)
      if (!agent || agent.mode === "primary") throw new Error(`Unknown subagent type: ${task.subagent_type}`)
      resolved.set(task.subagent_type, agent)
    }

    const run: AdaptiveRunLauncher<Item, string>["launch"] = async (queued, context) => {
      const task = queued.data
      const agent = resolved.get(task.subagent_type)!
      const existingID = context.retryRunID ?? task.task_id
      const child = existingID
        ? await Session.get(existingID).then((session) => {
            assertOwnedSubagentRun(
              { id: session.id, parentID: session.parentID, profile: session.agentID, title: session.title },
              { parentSessionID: ctx.sessionID, profile: agent.name },
            )
            return session
          })
        : await Session.create({
            parentID: ctx.sessionID,
            agentID: agent.name,
            title: `${task.description} (@${agent.name} subagent)`,
            permission: [
              { permission: "todowrite", pattern: "*", action: "deny" },
              { permission: "todoread", pattern: "*", action: "deny" },
              ...(agent.permission.some((rule) => rule.permission === "task")
                ? []
                : [{ permission: "task", pattern: "*", action: "deny" as const }]),
            ],
          })

      if (!existingID) await PermissionNext.setMode(child.id, await PermissionNext.getMode(ctx.sessionID))
      const model = agent.model ?? { providerID: parentMessage.info.providerID, modelID: parentMessage.info.modelID }
      const tools = {
        todowrite: false,
        todoread: false,
        ...(agent.permission.some((rule) => rule.permission === "task") ? {} : { task: false }),
        ...Object.fromEntries((config.experimental?.primary_tools ?? []).map((tool) => [tool, false])),
      }
      const cancel = () => SessionPrompt.cancel(child.id)
      context.signal.addEventListener("abort", cancel, { once: true })
      context.onReady()

      const completion = (async () => {
        await HookDispatcher.emit({
          name: "SubagentStart",
          timestamp: Date.now(),
          sessionId: ctx.sessionID,
          payload: { agent: agent.name, childSessionID: child.id, swarm: true },
        })
        try {
          let result = context.retryRunID
            ? await SessionPrompt.retry(child.id)
            : await SessionPrompt.prompt({
                sessionID: child.id,
                agent: agent.name,
                model,
                tools,
                parts: await SessionPrompt.resolvePromptParts(task.prompt),
              })
          context.signal.throwIfAborted()
          throwIfSubagentMessageFailed(result)
          let text = result.parts.findLast((part) => part.type === "text")?.text ?? ""
          const policy = agent.summaryPolicy
          for (
            let attempt = 0;
            attempt < (policy?.retries ?? 0) && needsSubagentSummaryContinuation(text, policy);
            attempt += 1
          ) {
            result = await SessionPrompt.prompt({
              sessionID: child.id,
              agent: agent.name,
              model,
              tools,
              parts: [{ type: "text", text: policy!.continuationPrompt }],
            })
            context.signal.throwIfAborted()
            throwIfSubagentMessageFailed(result)
            const continued = result.parts.findLast((part) => part.type === "text")?.text ?? ""
            if (continued.trim()) text = continued
          }
          context.signal.throwIfAborted()
          return text
        } finally {
          context.signal.removeEventListener("abort", cancel)
          await HookDispatcher.emit({
            name: "SubagentStop",
            timestamp: Date.now(),
            sessionId: ctx.sessionID,
            payload: { agent: agent.name, childSessionID: child.id, swarm: true },
          })
        }
      })()

      return { runID: child.id, completion }
    }

    const suspended: Array<{ task: string; runID: string; reason: string }> = []
    const launcher: AdaptiveRunLauncher<Item, string> = {
      launch: run,
      suspended(event) {
        suspended.push({ task: event.task.data.description, runID: event.runID, reason: event.reason })
      },
    }
    const batch = new AdaptiveRunBatch(
      launcher,
      params.tasks.map((task) => ({ data: task, timeoutMs: task.timeout_ms, signal: ctx.abort })),
      { maxConcurrency: params.max_concurrency ?? resolveAdaptiveConcurrency() },
    )
    const results = await batch.run()
    return {
      title: `${params.tasks.length} agent swarm`,
      metadata: {
        completed: results.filter((result) => result.status === "completed").length,
        failed: results.filter((result) => result.status === "failed").length,
        suspended,
      },
      output: JSON.stringify(
        results.map((result) => ({
          description: result.task.data.description,
          subagent_type: result.task.data.subagent_type,
          task_id: result.runID,
          status: result.status,
          result: result.result,
          error: result.error,
        })),
        null,
        2,
      ),
    }
  },
}))
