import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { Instance } from "../../src/runtime/context/project/instance"
import { Session } from "../../src/runtime/session"
import { SessionTrace } from "../../src/runtime/session/trace"
import { SessionSupportBundle } from "../../src/runtime/session/support-bundle"
import { Identifier } from "../../src/shared/id/id"
import { Global } from "../../src/runtime/context/global"
import { tmpdir } from "../fixture/fixture"

describe("durable session replay", () => {
  const prevDisableTrace = process.env.GIZZI_DISABLE_DURABLE_TRACE

  beforeAll(() => {
    delete process.env.GIZZI_DISABLE_DURABLE_TRACE
  })

  afterAll(() => {
    if (prevDisableTrace === undefined) delete process.env.GIZZI_DISABLE_DURABLE_TRACE
    else process.env.GIZZI_DISABLE_DURABLE_TRACE = prevDisableTrace
  })

  test("records ordered message, part, and delta events behind a cursor", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        const messageID = Identifier.ascending("message")
        const partID = Identifier.ascending("part")
        await Session.updateMessage({
          id: messageID,
          sessionID: session.id,
          role: "user",
          agent: "build",
          model: { providerID: "test", modelID: "test" },
          time: { created: Date.now() },
        })
        await Session.updatePart({ id: partID, messageID, sessionID: session.id, type: "text", text: "hel" })
        await Session.updatePartDelta({ sessionID: session.id, messageID, partID, field: "text", delta: "lo" })

        const head = SessionTrace.head(session.id)
        const first = SessionTrace.list({ sessionID: session.id, after: 0, through: head, limit: 2 })
        const second = SessionTrace.list({ sessionID: session.id, after: first.at(-1)!.sequence, through: head })
        expect([...first, ...second].map((entry) => entry.kind)).toEqual([
          "message.updated",
          "part.updated",
          "part.delta",
        ])
        expect(second.at(-1)?.sequence).toBe(head)
        await Session.remove(session.id)
      },
    })
  })

  test("support redaction removes secret-shaped keys, values, and home paths", () => {
    const redacted = SessionSupportBundle.redact({
      apiKey: "literal-secret",
      message: `Authorization: Bearer token-abcdefghijklmnopqrstuvwxyz ${Global.Path.home()}/project`,
    }) as { apiKey: string; message: string }
    expect(redacted.apiKey).toBe("<REDACTED>")
    expect(redacted.message).not.toContain("abcdefghijklmnopqrstuvwxyz")
    expect(redacted.message).toContain("<HOME>")
  })
})
