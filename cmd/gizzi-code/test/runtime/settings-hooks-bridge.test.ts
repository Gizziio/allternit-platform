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

  test("non-command/http hook types are skipped (prompt/agent are TUI-only)", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [
          { hooks: [{ type: "prompt", prompt: "verify $ARGUMENTS" }, { type: "agent", prompt: "verify $ARGUMENTS" }] },
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

describe("if conditions", () => {
  test("Bash(git *) runs for git commands and skips others", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [
          { hooks: [{ type: "command", command: "cat >> hook-log.jsonl", if: "Bash(git *)" }] },
        ],
      },
    })
    await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path, { toolInput: { command: "ls" } }))
    expect(await Bun.file(path.join(tmp.path, "hook-log.jsonl")).exists()).toBe(false)
    await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path, { toolInput: { command: "git status" } }))
    expect(await Bun.file(path.join(tmp.path, "hook-log.jsonl")).exists()).toBe(true)
  })

  test("tool-wide conditions and wrong-tool conditions", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [
          { hooks: [{ type: "command", command: "cat >> bash.jsonl", if: "Bash" }] },
          { hooks: [{ type: "command", command: "cat >> write.jsonl", if: "Write(*)" }] },
        ],
      },
    })
    await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path, { toolInput: { command: "ls" } }))
    expect(await Bun.file(path.join(tmp.path, "bash.jsonl")).exists()).toBe(true)
    expect(await Bun.file(path.join(tmp.path, "write.jsonl")).exists()).toBe(false)
  })

  test("matchesIfCondition is case-insensitive on the tool name and treats trailing junk as tool-name", () => {
    const input = hookInput("/tmp", { toolInput: { command: "git status" } })
    expect(SettingsHooksBridge.matchesIfCondition("bash(git *)", input)).toBe(true)
    expect(SettingsHooksBridge.matchesIfCondition("Bash(git *)garbage", input)).toBe(false)
  })
})

describe("async and once flags", () => {
  test("async hooks never gate, even on exit 2, but still run", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [
          { hooks: [{ type: "command", command: `echo denied >&2; exit 2`, async: true }] },
          { hooks: [{ type: "command", command: "echo ran >> async.log", async: true }] },
        ],
      },
    })
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("allow")
    // Fire-and-forget: the hook process still runs to completion.
    const deadline = Date.now() + 5000
    while (Date.now() < deadline) {
      if (await Bun.file(path.join(tmp.path, "async.log")).exists()) break
      await Bun.sleep(25)
    }
    expect(await Bun.file(path.join(tmp.path, "async.log")).exists()).toBe(true)
  })

  test("once hooks fire at most once per session", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "echo x >> once.log", once: true }] }],
      },
    })
    await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    // A different session id is a different session.
    await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path, { sessionId: "ses_other" }))
    const deadline = Date.now() + 5000
    let lines: string[] = []
    while (Date.now() < deadline) {
      const text = await Bun.file(path.join(tmp.path, "once.log")).text().catch(() => "")
      lines = text.trim().split("\n").filter(Boolean)
      if (lines.length >= 2) break
      await Bun.sleep(25)
    }
    expect(lines).toHaveLength(2)
  })
})

describe("updatedInput", () => {
  test("PreToolUse exit-0 JSON updatedInput is carried on the decision", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: `echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{"command":"echo rewritten"}}}'`,
              },
            ],
          },
        ],
      },
    })
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("allow")
    expect(result.updatedInput).toEqual({ command: "echo rewritten" })
  })

  test("non-object updatedInput is ignored; deny drops updatedInput", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: `echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":"nope"}}'`,
              },
            ],
          },
          {
            hooks: [
              {
                type: "command",
                command: `echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"stop","updatedInput":{"command":"x"}}}'`,
              },
            ],
          },
        ],
      },
    })
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("deny")
    expect(result.reason).toBe("stop")
    expect(result.updatedInput).toBeUndefined()
  })

  test("hookSpecificOutput addressed at a different event is ignored", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: `echo '{"hookSpecificOutput":{"hookEventName":"PostToolUse","permissionDecision":"deny","updatedInput":{"command":"x"}}}'`,
              },
            ],
          },
        ],
      },
    })
    const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("allow")
    expect(result.updatedInput).toBeUndefined()
  })
})

describe("permissionDecision ask", () => {
  test("ask aggregates with deny > ask > allow precedence", async () => {
    await using tmp = await tmpdir()
    const askEcho = `echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask"}}'`
    const allowEcho = `echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'`
    const denyEcho = `echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny"}}'`
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: allowEcho }, { type: "command", command: askEcho }] }],
      },
    })
    const askResult = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(askResult.decision).toBe("ask")
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: askEcho }, { type: "command", command: denyEcho }] }],
      },
    })
    const denyResult = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
    expect(denyResult.decision).toBe("deny")
  })

  test("ask on PostToolUse degrades to allow", async () => {
    await using tmp = await tmpdir()
    await writeProjectSettings(tmp.path, {
      hooks: {
        PostToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: `echo '{"hookSpecificOutput":{"hookEventName":"PostToolUse","permissionDecision":"ask"}}'`,
              },
            ],
          },
        ],
      },
    })
    const result = await SettingsHooksBridge.runToolEvent("PostToolUse", hookInput(tmp.path))
    expect(result.decision).toBe("allow")
  })
})

describe("http hooks", () => {
  async function withServer(
    handler: (req: Request, body: string) => Response | Promise<Response>,
    fn: (url: string, requests: string[]) => Promise<void>,
  ) {
    const requests: string[] = []
    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      async fetch(req) {
        const body = await req.text()
        requests.push(body)
        return handler(req, body)
      },
    })
    try {
      await fn(`http://127.0.0.1:${server.port}/hook`, requests)
    } finally {
      server.stop(true)
    }
  }

  test("POSTs the event JSON and gates on a decision:block body", async () => {
    await using tmp = await tmpdir()
    await withServer(() => Response.json({ decision: "block", reason: "http nope" }), async (url, requests) => {
      await writeProjectSettings(tmp.path, {
        hooks: { PreToolUse: [{ hooks: [{ type: "http", url }] }] },
      })
      const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
      expect(result.decision).toBe("deny")
      expect(result.reason).toBe("http nope")
      expect(requests).toHaveLength(1)
      const payload = JSON.parse(requests[0]!)
      expect(payload.hook_event_name).toBe("PreToolUse")
      expect(payload.tool_name).toBe("bash")
      expect(payload.tool_input).toEqual({ command: "ls" })
    })
  })

  test("permissionDecision deny/ask and updatedInput work over http", async () => {
    await using tmp = await tmpdir()
    await withServer(
      () =>
        Response.json({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "ask",
            updatedInput: { command: "echo via-http" },
          },
        }),
      async (url) => {
        await writeProjectSettings(tmp.path, {
          hooks: { PreToolUse: [{ hooks: [{ type: "http", url }] }] },
        })
        const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
        expect(result.decision).toBe("ask")
        expect(result.updatedInput).toEqual({ command: "echo via-http" })
      },
    )
  })

  test("non-2xx and non-JSON bodies fail open", async () => {
    await using tmp = await tmpdir()
    await withServer(() => new Response("broken", { status: 500 }), async (url, requests) => {
      await writeProjectSettings(tmp.path, {
        hooks: { PreToolUse: [{ hooks: [{ type: "http", url }] }] },
      })
      const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
      expect(result.decision).toBe("allow")
      expect(requests).toHaveLength(1)
    })
  })

  test("allowedHttpHookUrls blocks non-matching URLs (fail open, no request made)", async () => {
    await using tmp = await tmpdir()
    await withServer(() => Response.json({}), async (url, requests) => {
      await writeProjectSettings(tmp.path, {
        allowedHttpHookUrls: ["https://hooks.example.com/*"],
        hooks: { PreToolUse: [{ hooks: [{ type: "http", url }] }] },
      })
      const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
      expect(result.decision).toBe("allow")
      expect(requests).toHaveLength(0)
    })
  })

  test("header env interpolation is restricted to allowedEnvVars and CRLF-stripped", async () => {
    await using tmp = await tmpdir()
    process.env.P7_HOOK_TOKEN = "secret-token"
    process.env.P7_HOOK_EVIL = "evil\r\nX-Injected: 1"
    try {
      await withServer(
        (req) =>
          Response.json({
            decision: "block",
            reason: JSON.stringify({
              auth: req.headers.get("authorization"),
              other: req.headers.get("x-other"),
              evil: req.headers.get("x-evil"),
              injected: req.headers.get("x-injected"),
            }),
          }),
        async (url) => {
          await writeProjectSettings(tmp.path, {
            hooks: {
              PreToolUse: [
                {
                  hooks: [
                    {
                      type: "http",
                      url,
                      headers: {
                        Authorization: "Bearer $P7_HOOK_TOKEN",
                        "X-Other": "$P7_UNLISTED",
                        "X-Evil": "${P7_HOOK_EVIL}",
                      },
                      allowedEnvVars: ["P7_HOOK_TOKEN", "P7_HOOK_EVIL"],
                    },
                  ],
                },
              ],
            },
          })
          const result = await SettingsHooksBridge.runToolEvent("PreToolUse", hookInput(tmp.path))
          expect(result.decision).toBe("deny")
          const seen = JSON.parse(result.reason!)
          expect(seen.auth).toBe("Bearer secret-token")
          // Not in allowedEnvVars -> empty string
          expect(seen.other).toBe("")
          // CRLF stripped, no header injection
          expect(seen.evil).toBe("evilX-Injected: 1")
          expect(seen.injected).toBeNull()
        },
      )
    } finally {
      delete process.env.P7_HOOK_TOKEN
      delete process.env.P7_HOOK_EVIL
    }
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

  test("updatedInput from a settings hook replaces the tool args before execution", async () => {
    await using tmp = await tmpdir({ git: true })
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: `echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"command":"echo rewritten","extra":"added"}}}'`,
              },
            ],
          },
        ],
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        let receivedArgs: any
        const result: any = await ToolDispatcher.executeInitialized(
          "bash",
          { command: "ls" },
          fakeCtx(),
          async (args) => {
            receivedArgs = args
            return { title: "ok", output: "ran", metadata: {} }
          },
        )
        expect(result.output).toBe("ran")
        // Replace semantics (ink-app: processedInput = result.updatedInput)
        expect(receivedArgs).toEqual({ command: "echo rewritten", extra: "added" })
      },
    })
  })

  test("permissionDecision ask routes through ctx.ask; approval executes with the rewritten input", async () => {
    await using tmp = await tmpdir({ git: true })
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: `echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","updatedInput":{"command":"echo asked"}}}'`,
              },
            ],
          },
        ],
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const asks: any[] = []
        const ctx: any = {
          ...fakeCtx(),
          ask: async (req: any) => {
            asks.push(req)
          },
        }
        let receivedArgs: any
        const result: any = await ToolDispatcher.executeInitialized(
          "bash",
          { command: "rm -rf /" },
          ctx,
          async (args) => {
            receivedArgs = args
            return { title: "ok", output: "ran", metadata: {} }
          },
        )
        expect(result.output).toBe("ran")
        expect(asks).toHaveLength(1)
        expect(asks[0].permission).toBe("bash")
        // Patterns derived from the rewritten args
        expect(asks[0].patterns).toContain("echo asked")
        expect(receivedArgs).toEqual({ command: "echo asked" })
      },
    })
  })

  test("permissionDecision ask denied at the prompt yields a structured denial, never silent allow", async () => {
    await using tmp = await tmpdir({ git: true })
    await writeProjectSettings(tmp.path, {
      hooks: {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: `echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask"}}'`,
              },
            ],
          },
        ],
        PostToolUseFailure: [{ hooks: [{ type: "command", command: "cat >> fail.jsonl" }] }],
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const ctx: any = {
          ...fakeCtx(),
          ask: async () => {
            throw new Error("user rejected")
          },
        }
        let executed = false
        const result: any = await ToolDispatcher.executeInitialized(
          "bash",
          { command: "ls" },
          ctx,
          async () => {
            executed = true
            return { title: "ok", output: "ran", metadata: {} }
          },
        )
        expect(executed).toBe(false)
        expect(result.metadata?.denied).toBe(true)
        expect(result.output).toContain("user rejected")
        const fail = JSON.parse((await Bun.file(path.join(tmp.path, "fail.jsonl")).text()).trim())
        expect(fail.hook_event_name).toBe("PostToolUseFailure")
      },
    })
  })
})
