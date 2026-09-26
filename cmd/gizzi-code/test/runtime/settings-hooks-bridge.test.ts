import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import path from "path"
import { Instance } from "../../src/runtime/context/project/instance"
import { SettingsHooksBridge } from "../../src/runtime/hooks/settings-bridge"
import { ToolDispatcher } from "../../src/runtime/tools/dispatch"
import { tmpdir } from "../fixture/fixture"

// Hermetic user scope: point the config home at an empty tmp dir per test so
// the developer's real ~/.gizzi/settings.json can never leak hooks in.
let savedConfigDir: string | undefined
let savedLegacyDir: string | undefined
let savedDisable: string | undefined
let userHome: Awaited<ReturnType<typeof tmpdir>> | undefined

beforeEach(async () => {
  savedConfigDir = process.env.GIZZI_CONFIG_DIR
  savedLegacyDir = process.env.CLAUDE_CONFIG_DIR
  savedDisable = process.env.GIZZI_SETTINGS_HOOKS
  delete process.env.GIZZI_SETTINGS_HOOKS
  userHome = await tmpdir()
  process.env.GIZZI_CONFIG_DIR = userHome.path
  // Keep the legacy home pointed somewhere empty too
  process.env.CLAUDE_CONFIG_DIR = path.join(userHome.path, "legacy")
  SettingsHooksBridge.resetCache()
})

afterEach(async () => {
  if (savedConfigDir === undefined) delete process.env.GIZZI_CONFIG_DIR
  else process.env.GIZZI_CONFIG_DIR = savedConfigDir
  if (savedLegacyDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
  else process.env.CLAUDE_CONFIG_DIR = savedLegacyDir
  if (savedDisable === undefined) delete process.env.GIZZI_SETTINGS_HOOKS
  else process.env.GIZZI_SETTINGS_HOOKS = savedDisable
  SettingsHooksBridge.resetCache()
  await userHome?.[Symbol.asyncDispose]()
  userHome = undefined
})

async function writeProjectSettings(cwd: string, settings: unknown, flavor: ".gizzi" | ".claude" = ".gizzi") {
  await Bun.write(path.join(cwd, flavor, "settings.json"), JSON.stringify(settings))
}

function hookInput(cwd: string, overrides?: Partial<SettingsHooksBridge.ToolHookInput>): SettingsHooksBridge.ToolHookInput {
  return {
    sessionId: "ses_test",
    cwd,
    toolName: "bash",
    toolInput: { command: "ls" },
    ...overrides,
  }
}

describe("matchesPattern", () => {
  test("empty and * match everything", () => {
    expect(SettingsHooksBridge.matchesPattern("bash", "")).toBe(true)
    expect(SettingsHooksBridge.matchesPattern("bash", "*")).toBe(true)
  })

  test("simple names match case-insensitively (Claude-style matcher vs runtime id)", () => {
    expect(SettingsHooksBridge.matchesPattern("bash", "Bash")).toBe(true)
    expect(SettingsHooksBridge.matchesPattern("bash", "bash")).toBe(true)
    expect(SettingsHooksBridge.matchesPattern("bash", "Read")).toBe(false)
  })

  test("pipe lists match any alternative", () => {
    expect(SettingsHooksBridge.matchesPattern("edit", "Write|Edit")).toBe(true)
    expect(SettingsHooksBridge.matchesPattern("bash", "Write|Edit")).toBe(false)
  })

  test("regex matchers apply, invalid regex never matches", () => {
    expect(SettingsHooksBridge.matchesPattern("bash", "^ba")).toBe(true)
    expect(SettingsHooksBridge.matchesPattern("edit", "^ba")).toBe(false)
    expect(SettingsHooksBridge.matchesPattern("bash", "([invalid")).toBe(false)
  })
})

describe("runToolEvent", () => {
  test("runs a matching command hook and passes the Claude-Code stdin contract", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [
          { matcher: "Bash", hooks: [{ type: "command", command: "cat >> hook-log.jsonl" }] },
        ],
      },
    })
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("allow")
    const log = JSON.parse((await Bun.file(path.join(tmp.path, "hook-log.jsonl")).text()).trim())
    expect(log.hook_event_name).toBe("PreToolUse")
    expect(log.tool_name).toBe("bash")
    expect(log.tool_input).toEqual({ command: "ls" })
    expect(log.session_id).toBe("ses_test")
    expect(log.cwd).toBe(tmp.path)
  })

  test("matcher filtering: non-matching tool does not spawn the hook", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [
          { matcher: "Read", hooks: [{ type: "command", command: "cat >> hook-log.jsonl" }] },
        ],
      },
    })
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("allow")
    expect(await Bun.file(path.join(tmp.path, "hook-log.jsonl")).exists()).toBe(false)
  })

  test("matcher-less entries match every tool", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "cat >> hook-log.jsonl" }] }],
      },
    })
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path, { toolName: "write" }))
    expect(result.decision).toBe("allow")
    expect(await Bun.file(path.join(tmp.path, "hook-log.jsonl")).exists()).toBe(true)
  })

  test("exit 2 denies with stderr as the reason", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: `echo "no way" >&2; exit 2` }] }],
      },
    })
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("deny")
    expect(result.reason).toBe("no way")
  })

  test("exit 0 with JSON decision:block denies with the reason", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: `echo '{"decision":"block","reason":"policy"}'` }] }],
      },
    })
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("deny")
    expect(result.reason).toBe("policy")
  })

  test("hookSpecificOutput.permissionDecision deny is honored", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: `echo '{"hookSpecificOutput":{"permissionDecision":"deny","permissionDecisionReason":"nope"}}'`,
              },
            ],
          },
        ],
      },
    })
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("deny")
    expect(result.reason).toBe("nope")
  })

  test("non-zero exit other than 2 fails open", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "exit 1" }] }],
      },
    })
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("allow")
  })

  test("hook timeout kills the process and fails open", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "sleep 30", timeout: 1 }] }],
      },
    })
    const start = Date.now()
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("allow")
    expect(Date.now() - start).toBeLessThan(10_000)
  }, 15_000)

  test("disableAllHooks suppresses every settings hook", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      disableAllHooks: true,
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "cat >> hook-log.jsonl" }] }],
      },
    })
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("allow")
    expect(await Bun.file(path.join(tmp.path, "hook-log.jsonl")).exists()).toBe(false)
  })

  test(".gizzi/settings.json wins over .claude/settings.json when both exist", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, { hooks: {} }, ".gizzi")
    await writeProjectSettings(
      tmp.path,
      {
        hooks: {
          PreToolUse: [{ hooks: [{ type: "command", command: "cat >> hook-log.jsonl" }] }],
        },
      },
      ".claude",
    )
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("allow")
    expect(await Bun.file(path.join(tmp.path, "hook-log.jsonl")).exists()).toBe(false)
  })

  test("falls back to .claude/settings.json when no .gizzi file exists", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(
      tmp.path,
      {
        hooks: {
          PreToolUse: [{ hooks: [{ type: "command", command: "cat >> hook-log.jsonl" }] }],
        },
      },
      ".claude",
    )
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("allow")
    expect(await Bun.file(path.join(tmp.path, "hook-log.jsonl")).exists()).toBe(true)
  })

  test("user-scope settings (GIZZI_CONFIG_DIR/settings.json) hooks run", async () => {
    await using tmp = await tmpdir()
    await Bun.write(
      path.join(userHome!.path, "settings.json"),
      JSON.stringify({
        hooks: {
          PreToolUse: [{ hooks: [{ type: "command", command: `cat >> "${path.join(tmp.path, "hook-log.jsonl")}"` }] }],
        },
      }),
    )
    SettingsHooksBridge.resetCache()
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("allow")
    expect(await Bun.file(path.join(tmp.path, "hook-log.jsonl")).exists()).toBe(true)
  })

  test("non-command hook types are skipped (deferred to the TUI)", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [
          { hooks: [{ type: "prompt", prompt: "verify $ARGUMENTS" }, { type: "http", url: "http://127.0.0.1:1/hook" }] },
        ],
      },
    })
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("allow")
  })

  test("GIZZI_SETTINGS_HOOKS=0 disables the bridge", async () => {
    await using tmp = await tmpdir()
    process.env.GIZZI_SETTINGS_HOOKS = "0"
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "cat >> hook-log.jsonl" }] }],
      },
    })
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("allow")
    expect(await Bun.file(path.join(tmp.path, "hook-log.jsonl")).exists()).toBe(false)
  })

  test("PostToolUse payload carries tool_response, PostToolUseFailure carries error", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PostToolUse: [{ hooks: [{ type: "command", command: "cat >> post.jsonl" }] }],
        PostToolUseFailure: [{ hooks: [{ type: "command", command: "cat >> fail.jsonl" }] }],
      },
    })
    await SettingsHooksBridge.runToolEvent("PostToolUse", hookInput(tmp.path, { toolResponse: { output: "done" } }))
    await SettingsHooksBridge.runToolEvent("PostToolUseFailure", hookInput(tmp.path, { error: "boom" }))
    const post = JSON.parse((await Bun.file(path.join(tmp.path, "post.jsonl")).text()).trim())
    expect(post.hook_event_name).toBe("PostToolUse")
    expect(post.tool_response).toEqual({ output: "done" })
    const fail = JSON.parse((await Bun.file(path.join(tmp.path, "fail.jsonl")).text()).trim())
    expect(fail.hook_event_name).toBe("PostToolUseFailure")
    expect(fail.error).toBe("boom")
  })
})

describe("ToolDispatcher gating", () => {
  function fakeCtx(): any {
    return {
      sessionID: "ses_dispatch",
      messageID: "msg_1",
      agent: "build",
      abort: new AbortController().signal,
      messages: [],
      metadata: () => {},
      ask: async () => {},
    }
  }

  test("PreToolUse deny from settings blocks execution with a structured denial", async () => {
    await using tmp = await tmpdir({ git: true })
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: `echo "blocked by test" >&2; exit 2` }] }],
        PostToolUseFailure: [{ hooks: [{ type: "command", command: "cat >> fail.jsonl" }] }],
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        let executed = false
        const result: any = await ToolDispatcher.executeInitialized(
          "bash",
          { command: "ls" },
          fakeCtx(),
          async () => {
            executed = true
            return { title: "ok", output: "ran", metadata: {} }
          },
        )
        expect(executed).toBe(false)
        expect(result.metadata?.denied).toBe(true)
        expect(result.output).toContain("blocked by test")
        // The denial also fires PostToolUseFailure settings hooks
        const fail = JSON.parse((await Bun.file(path.join(tmp.path, "fail.jsonl")).text()).trim())
        expect(fail.hook_event_name).toBe("PostToolUseFailure")
      },
    })
  })

  test("allowed calls execute and fire PostToolUse with the tool response", async () => {
    await using tmp = await tmpdir({ git: true })
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "cat >> pre.jsonl" }] }],
        PostToolUse: [{ hooks: [{ type: "command", command: "cat >> post.jsonl" }] }],
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        let executed = false
        const result: any = await ToolDispatcher.executeInitialized(
          "bash",
          { command: "ls" },
          fakeCtx(),
          async () => {
            executed = true
            return { title: "ok", output: "ran", metadata: {} }
          },
        )
        expect(executed).toBe(true)
        expect(result.output).toBe("ran")
        const post = JSON.parse((await Bun.file(path.join(tmp.path, "post.jsonl")).text()).trim())
        expect(post.hook_event_name).toBe("PostToolUse")
        expect(post.tool_name).toBe("bash")
        expect(post.tool_response.output).toBe("ran")
      },
    })
  })

  test("a throwing tool fires PostToolUseFailure settings hooks and rethrows", async () => {
    await using tmp = await tmpdir({ git: true })
    await writeProjectSettings(tmp.path, {
      hooks: {
        PostToolUseFailure: [{ hooks: [{ type: "command", command: "cat >> fail.jsonl" }] }],
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        let threw = false
        try {
          await ToolDispatcher.executeInitialized("bash", { command: "ls" }, fakeCtx(), async () => {
            throw new Error("tool exploded")
          })
        } catch {
          threw = true
        }
        expect(threw).toBe(true)
        const fail = JSON.parse((await Bun.file(path.join(tmp.path, "fail.jsonl")).text()).trim())
        expect(fail.hook_event_name).toBe("PostToolUseFailure")
        expect(fail.error).toContain("tool exploded")
      },
    })
  })
})
