import { describe, expect, test } from "bun:test"
import type { Hooks } from "../../packages/plugin/src/index"

// Contract test for the plugin SDK Hooks type: the runtime triggers these
// eight hooks by name (Plugin.trigger in src/runtime/integrations/plugin) and
// the SDK type must declare them so plugin authors get typing. If the SDK
// Hooks type drifts from the runtime contract, this file stops compiling
// (tsc --noEmit) even though the runtime dispatch is string-based.

const hooks: Hooks = {
  "shell.env": async (input, output) => {
    const _cwd: string = input.cwd
    const _sessionID: string | undefined = input.sessionID
    const _callID: string | undefined = input.callID
    output.env.PATH = "/usr/bin"
  },
  "tool.definition": async (input, output) => {
    const _toolID: string = input.toolID
    const _description: string = output.description
    const _parameters = output.parameters
  },
  "experimental.chat.system.transform": async (input, output) => {
    const _sessionID: string | undefined = input.sessionID
    const _providerID: string = input.model.providerID
    const _id: string = input.model.id
    output.system.push("extra")
  },
  "chat.params": async (input, output) => {
    const _sessionID: string = input.sessionID
    const _agentName: string = input.agent.name
    const _temperature: number | undefined = input.agent.temperature
    const _providerID: string = input.model.providerID
    const _messageID: string = input.message.id
    output.temperature = 0.5
    output.options.custom = true
  },
  "experimental.text.complete": async (input, output) => {
    const _sessionID: string = input.sessionID
    const _messageID: string = input.messageID
    const _partID: string = input.partID
    output.text = output.text.trim()
  },
  "experimental.chat.messages.transform": async (input, output) => {
    const _noInput: Record<string, never> = input
    output.messages.push({ role: "user" })
  },
  "chat.message": async (input, output) => {
    const _sessionID: string = input.sessionID
    const _agent: string | undefined = input.agent
    const _messageID: string | undefined = input.messageID
    output.parts.push({ type: "text", text: "observed" })
  },
  "command.execute.before": async (input, output) => {
    const _command: string = input.command
    const _sessionID: string = input.sessionID
    const _arguments: string = input.arguments
    output.parts.push({ type: "text", text: "injected" })
  },
}

// Mirror of Plugin.trigger's dispatch loop (src/runtime/integrations/plugin)
// — string-name dispatch over loaded hook objects, mutating the output bag.
type HookName = {
  [K in keyof Required<Hooks>]: Required<Hooks>[K] extends (input: any, output: any) => any ? K : never
}[keyof Required<Hooks>]

async function trigger<Name extends HookName>(
  name: Name,
  input: Parameters<Extract<Required<Hooks>[Name], (input: any, output: any) => any>>[0],
  output: Parameters<Extract<Required<Hooks>[Name], (input: any, output: any) => any>>[1],
): Promise<typeof output> {
  for (const hook of [hooks]) {
    const fn = hook[name]
    if (!fn) continue
    await (fn as (i: typeof input, o: typeof output) => void | Promise<void>)(input, output)
  }
  return output
}

describe("plugin SDK Hooks contract", () => {
  test("shell.env round-trips an env bag (bash tool / PTY / prompt call sites)", async () => {
    const out = await trigger("shell.env", { cwd: "/tmp" }, { env: {} })
    expect(out.env.PATH).toBe("/usr/bin")
  })

  test("tool.definition receives toolID and a mutable definition bag", async () => {
    const out = await trigger(
      "tool.definition",
      { toolID: "bash" },
      { description: "run a command", parameters: {} as any },
    )
    expect(out.description).toBe("run a command")
  })

  test("experimental.chat.system.transform mutates the system parts array", async () => {
    const out = await trigger(
      "experimental.chat.system.transform",
      { model: { providerID: "anthropic", id: "claude" } },
      { system: ["base"] },
    )
    expect(out.system).toEqual(["base", "extra"])
  })

  test("chat.params exposes generation params and options", async () => {
    const out = await trigger(
      "chat.params",
      {
        sessionID: "ses_1",
        agent: { name: "build" },
        model: { providerID: "anthropic", id: "claude" },
        provider: {},
        message: { id: "msg_1" },
      },
      { temperature: undefined, topP: undefined, topK: undefined, options: {} },
    )
    expect(out.temperature).toBe(0.5)
    expect(out.options.custom).toBe(true)
  })

  test("experimental.text.complete rewrites the final text", async () => {
    const out = await trigger(
      "experimental.text.complete",
      { sessionID: "ses_1", messageID: "msg_1", partID: "part_1" },
      { text: "  hello  " },
    )
    expect(out.text).toBe("hello")
  })

  test("experimental.chat.messages.transform mutates the assembled message list", async () => {
    const out = await trigger("experimental.chat.messages.transform", {}, { messages: [] as unknown[] })
    expect(out.messages).toEqual([{ role: "user" }])
  })

  test("chat.message observes the assembled user message and parts", async () => {
    const out = await trigger(
      "chat.message",
      { sessionID: "ses_1", agent: "build", messageID: "msg_1" },
      { message: { id: "msg_1" }, parts: [] as unknown[] },
    )
    expect(out.parts).toEqual([{ type: "text", text: "observed" }])
  })

  test("command.execute.before can inject parts before execution", async () => {
    const out = await trigger(
      "command.execute.before",
      { command: "gizzi status", sessionID: "ses_1", arguments: "status" },
      { parts: [] as unknown[] },
    )
    expect(out.parts).toEqual([{ type: "text", text: "injected" }])
  })
})
