import { afterEach, describe, expect, test } from "bun:test"
import {
  checkToolHardBan,
  formatHardBanDenial,
  getAgentHardBans,
  getRuntimeAgentId,
} from "../../src/shared/utils/agentHardBans"

const ENV_KEYS = ["ALLTERNIT_AGENT_HARD_BANS", "ALLTERNIT_AGENT_ID"] as const
const saved: Record<string, string | undefined> = {}
for (const key of ENV_KEYS) saved[key] = process.env[key]

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

function setBans(value: string | undefined) {
  if (value === undefined) delete process.env.ALLTERNIT_AGENT_HARD_BANS
  else process.env.ALLTERNIT_AGENT_HARD_BANS = value
}

describe("getAgentHardBans", () => {
  test("no env → no bans", () => {
    setBans(undefined)
    expect(getAgentHardBans()).toEqual([])
  })

  test("plain category strings default to tool-block", () => {
    setBans('["email_send"]')
    expect(getAgentHardBans()).toEqual([{ category: "email_send" }])
  })

  test("RoleHardBan-shaped objects keep enforcement and label", () => {
    setBans('[{"category":"email_send","enforcement":"tool-block","label":"No cold email"}]')
    expect(getAgentHardBans()).toEqual([
      { category: "email_send", enforcement: "tool-block", label: "No cold email" },
    ])
  })

  test("malformed JSON degrades to no bans", () => {
    setBans("not json")
    expect(getAgentHardBans()).toEqual([])
  })
})

describe("checkToolHardBan", () => {
  test("no bans configured → everything allowed", () => {
    setBans(undefined)
    expect(checkToolHardBan("send_agent_email", { to: "a@b.c" })).toBeNull()
    expect(
      checkToolHardBan("mcp__allternit-connectors__execute_action", { actionId: "gmail.send_email" }),
    ).toBeNull()
  })

  test("email_send bans the native send_agent_email tool", () => {
    setBans('["email_send"]')
    const v = checkToolHardBan("send_agent_email", { to: "a@b.c" })
    expect(v?.category).toBe("email_send")
    expect(v?.matched).toBe("send_agent_email")
  })

  test("email_send bans gmail.send_email via execute_action actionId", () => {
    setBans('[{"category":"email_send","enforcement":"tool-block"}]')
    const v = checkToolHardBan("mcp__allternit-connectors__execute_action", {
      actionId: "gmail.send_email",
      input: { to: "a@b.c" },
    })
    expect(v?.category).toBe("email_send")
    expect(v?.matched).toBe("gmail.send_email")
  })

  test("email_send bans *.reply_email action ids", () => {
    setBans('["email_send"]')
    expect(
      checkToolHardBan("mcp__allternit-connectors__execute_action", { actionId: "gmail.reply_email" }),
    ).not.toBeNull()
  })

  test("external_communication shares the email-sending policy", () => {
    setBans('["external_communication"]')
    expect(checkToolHardBan("send_agent_email", {})).not.toBeNull()
    expect(
      checkToolHardBan("mcp__allternit-connectors__execute_action", { actionId: "gmail.send_email" }),
    ).not.toBeNull()
  })

  test("email_send bans MCP allternit_mail.send (normalized tool name)", () => {
    setBans('["email_send"]')
    expect(checkToolHardBan("mcp__allternit-connectors__allternit_mail_send", {})).not.toBeNull()
  })

  test("email_send bans direct gmail_send_email MCP tools", () => {
    setBans('["email_send"]')
    expect(checkToolHardBan("mcp__allternit-connectors__gmail_send_email", {})).not.toBeNull()
  })

  test("prompt-only bans are not enforced at dispatch", () => {
    setBans('[{"category":"email_send","enforcement":"prompt-only"}]')
    expect(checkToolHardBan("send_agent_email", {})).toBeNull()
  })

  test("non-email tools and actions stay allowed", () => {
    setBans('["email_send"]')
    expect(checkToolHardBan("read", { file_path: "/tmp/x" })).toBeNull()
    expect(
      checkToolHardBan("mcp__allternit-connectors__execute_action", { actionId: "gmail.search_emails" }),
    ).toBeNull()
    expect(
      checkToolHardBan("mcp__allternit-connectors__execute_action", { actionId: "drive.upload_file" }),
    ).toBeNull()
    expect(checkToolHardBan("get_agent_email_status", {})).toBeNull()
    expect(checkToolHardBan("mcp__allternit-connectors__allternit_mail_status", {})).toBeNull()
  })

  test("unmapped categories enforce nothing", () => {
    setBans('["deploy"]')
    expect(checkToolHardBan("send_agent_email", {})).toBeNull()
  })
})

describe("formatHardBanDenial", () => {
  test("carries the structured policy phrase", () => {
    setBans('["email_send"]')
    const v = checkToolHardBan("send_agent_email", {})!
    expect(formatHardBanDenial(v)).toStartWith("blocked by agent policy: email_send")
  })
})

describe("getRuntimeAgentId", () => {
  test("reads ALLTERNIT_AGENT_ID", () => {
    delete process.env.ALLTERNIT_AGENT_ID
    expect(getRuntimeAgentId()).toBeUndefined()
    process.env.ALLTERNIT_AGENT_ID = "agent-123"
    expect(getRuntimeAgentId()).toBe("agent-123")
  })
})
