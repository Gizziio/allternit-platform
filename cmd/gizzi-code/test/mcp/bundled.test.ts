import { afterEach, describe, expect, test } from "bun:test"
import { bundledMcpServers, withBundledMcpServers } from "@/runtime/tools/mcp/bundled"

const originalDisable = process.env.GIZZI_DISABLE_BUNDLED_MCPS
const originalNpx = process.env.GIZZI_ALLOW_NPX_BUNDLED_MCPS

afterEach(() => {
  if (originalDisable === undefined) delete process.env.GIZZI_DISABLE_BUNDLED_MCPS
  else process.env.GIZZI_DISABLE_BUNDLED_MCPS = originalDisable
  if (originalNpx === undefined) delete process.env.GIZZI_ALLOW_NPX_BUNDLED_MCPS
  else process.env.GIZZI_ALLOW_NPX_BUNDLED_MCPS = originalNpx
})

describe("bundled MCP discovery", () => {
  test("uses installed entrypoints instead of network-backed npx", () => {
    delete process.env.GIZZI_ALLOW_NPX_BUNDLED_MCPS
    const servers = bundledMcpServers()

    expect(servers["sequential-thinking"]?.command[0]).toBe(process.execPath)
    expect(servers.context7?.command[0]).toBe(process.execPath)
    expect(servers["sequential-thinking"]?.command.join(" ")).not.toContain("npx")
    expect(servers.context7?.command.join(" ")).not.toContain("npx")
  })

  test("resolves the repository Superpowers server independently of cwd", () => {
    const command = bundledMcpServers({ cwd: "/tmp" }).superpowers?.command
    expect(command?.[0]).toBe(process.execPath)
    expect(command?.[1]).toEndWith("tools/mcp-servers/superpowers/superpowers-mcp.js")
  })

  test("lets users disable bundled servers or override one explicitly", () => {
    process.env.GIZZI_DISABLE_BUNDLED_MCPS = "1"
    expect(withBundledMcpServers()).toStrictEqual({})

    const custom = { type: "local" as const, command: ["custom-context7"] }
    expect(withBundledMcpServers({ context7: custom })).toStrictEqual({ context7: custom })
  })
})
