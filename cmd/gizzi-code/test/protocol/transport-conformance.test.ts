import { describe, expect, test } from "bun:test"
import {
  createHttpSessionContract,
  createLocalSessionContract,
  type SessionContract,
} from "@/runtime/protocol/session-contract"

function backend(): SessionContract {
  const rows = [{ id: "session-1", title: "One" }]
  return {
    async list() { return rows },
    async get(id) { return rows.find((row) => row.id === id)! },
    async create(input = {}) { return { id: "session-2", ...input } },
    async replay(id) { return { sessionID: id, head: 1, cursor: 1, hasMore: false, entries: [{ sequence: 1 }] } },
    async scratchpadList(id) { return { sessionID: id, rootSessionID: id, entries: [] } },
    async scratchpadRead(_id, file, shared = false) { return { content: "note", path: file, shared, bytes: 4 } },
    async scratchpadWrite(_id, input) { return { path: input.path, shared: input.shared ?? false, bytes: input.content.length } },
    async scratchpadRemove() { return true },
  }
}

function fetchAdapter(contract: SessionContract): typeof fetch {
  return (async (request: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof request === "string" ? request : request instanceof URL ? request : request.url)
    const segments = url.pathname.split("/").filter(Boolean).slice(2)
    let data: unknown
    if (segments[1] === "scratchpad" && segments[2] === "file" && init?.method === "PUT") {
      data = await contract.scratchpadWrite(segments[0]!, JSON.parse(String(init.body)))
    } else if (segments[1] === "scratchpad" && segments[2] === "file" && init?.method === "DELETE") {
      data = await contract.scratchpadRemove(segments[0]!, url.searchParams.get("path")!, url.searchParams.get("shared") === "true")
    } else if (segments[1] === "scratchpad" && segments[2] === "file") {
      data = await contract.scratchpadRead(segments[0]!, url.searchParams.get("path")!, url.searchParams.get("shared") === "true")
    } else if (segments[1] === "scratchpad") data = await contract.scratchpadList(segments[0]!)
    else if (init?.method === "POST") data = await contract.create(JSON.parse(String(init.body)))
    else if (segments[1] === "replay") data = await contract.replay(segments[0]!)
    else if (segments[0] === "list") data = await contract.list({ agentID: url.searchParams.get("agentID") ?? undefined })
    else if (segments[0]) data = await contract.get(segments[0])
    else throw new Error(`Unhandled test route: ${url.pathname}`)
    return Response.json({ version: 1, requestID: "request-1", data })
  }) as typeof fetch
}

describe("session contract transports", () => {
  test("HTTP and in-memory transports return the same canonical values", async () => {
    const local = createLocalSessionContract(backend())
    const http = createHttpSessionContract({ baseUrl: "http://localhost:4096", fetch: fetchAdapter(local) })
    expect(await http.list()).toEqual(await local.list())
    expect(await http.get("session-1")).toEqual(await local.get("session-1"))
    expect(await http.create({ title: "Two" })).toEqual(await local.create({ title: "Two" }))
    expect(await http.replay("session-1")).toEqual(await local.replay("session-1"))
    expect(await http.scratchpadList("session-1")).toEqual(await local.scratchpadList("session-1"))
    expect(await http.scratchpadRead("session-1", "note.md")).toEqual(await local.scratchpadRead("session-1", "note.md"))
    expect(await http.scratchpadWrite("session-1", { path: "note.md", content: "note" })).toEqual(
      await local.scratchpadWrite("session-1", { path: "note.md", content: "note" }),
    )
    expect(await http.scratchpadRemove("session-1", "note.md")).toBe(true)
  })
})
