import { describe, expect, test } from "bun:test"
import type { Hooks } from "../../packages/plugin/src/index"

// Contract test for the plugin SDK Hooks type: the runtime triggers these
// five hooks by name (Plugin.trigger in src/runtime/integrations/plugin) and
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
}

// Mirror of Plugin.trigger's dispatch loop (src/runtime/integrations/plugin)
// — string-name dispatch over loaded hook objects, mutating the output bag.
async function trigger<Name extends keyof Required<Hooks>>(
  name: Name,
  input: Parameters<Required<Hooks>[Name]>[0],
  output: Parameters<Required<Hooks>[Name]>[1],
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
})
