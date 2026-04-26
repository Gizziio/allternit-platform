/**
 * Bundled MCP Servers
 *
 * These MCP servers ship out of the box with all allternit products.
 * They are always available without user configuration, mirroring how
 * Claude Code bundles first-party MCP tools.
 *
 * Bundled servers:
 *   - sequential-thinking  (@modelcontextprotocol/server-sequential-thinking)
 *   - context7             (@upstash/context7-mcp)
 *   - superpowers          (tools/mcp-servers/superpowers)
 *
 * These are merged with user-defined MCP config at startup. User config
 * can override any bundled server by defining an entry with the same key.
 */

import type { Config } from "@/runtime/context/config/config"
import path from "path"

/**
 * Resolve the superpowers MCP server path relative to the allternit
 * monorepo root. Works whether gizzi is run from the repo root or from
 * cmd/gizzi-code/.
 */
function resolveSuperpowersPath(): string {
  const fromRepoRoot = path.resolve(process.cwd(), "tools/mcp-servers/superpowers/superpowers-mcp.js")
  return fromRepoRoot
}

export const BUNDLED_MCP_SERVERS: Record<string, Config.Mcp> = {
  "sequential-thinking": {
    type: "local",
    command: ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
  },
  context7: {
    type: "local",
    command: ["npx", "-y", "@upstash/context7-mcp@latest"],
  },
  superpowers: {
    type: "local",
    command: ["node", resolveSuperpowersPath()],
  },
}

/**
 * Merge bundled MCP servers with user-defined config.
 * User config takes precedence — any key defined by the user overrides the bundled entry.
 *
 * Set GIZZI_DISABLE_BUNDLED_MCPS=1 to skip all bundled servers (e.g. when running
 * as a headless API server where MCP tool latency is unacceptable).
 */
export function withBundledMcpServers(
  userMcp: Record<string, Config.Mcp | false | undefined> = {},
): Record<string, Config.Mcp> {
  const merged: Record<string, Config.Mcp> = {}

  if (!process.env.GIZZI_DISABLE_BUNDLED_MCPS) {
    for (const [key, server] of Object.entries(BUNDLED_MCP_SERVERS)) {
      merged[key] = server
    }
  }

  for (const [key, server] of Object.entries(userMcp)) {
    if (server === false || server === undefined) {
      // User explicitly disabled a bundled server
      delete merged[key]
    } else {
      merged[key] = server
    }
  }

  return merged
}
