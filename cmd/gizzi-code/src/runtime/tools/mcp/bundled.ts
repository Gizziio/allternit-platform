/**
 * Bundled MCP Servers
 *
 * These MCP servers are discovered from locally installed packages and
 * repository assets. Missing optional servers are skipped unless the user
 * explicitly enables the network-backed npx compatibility fallback.
 *
 * Bundled servers:
 *   - sequential-thinking  (@modelcontextprotocol/server-sequential-thinking)
 *   - context7             (@upstash/context7-mcp)
 *   - superpowers          (tools/mcp-servers/superpowers)
 *   - allternit-connectors (Rust API internal route — per-user connector
 *                           actions on connected apps; only when
 *                           ALLTERNIT_INTERNAL_SERVICE_TOKEN is configured)
 *
 * These are merged with user-defined MCP config at startup. User config
 * can override any bundled server by defining an entry with the same key.
 */

import type { Config } from "@/runtime/context/config/config"
import { existsSync } from "fs"
import { createRequire } from "module"
import path from "path"

const require = createRequire(import.meta.url)

/**
 * Resolve the superpowers MCP server path relative to the allternit
 * monorepo root. Works whether gizzi is run from the repo root or from
 * cmd/gizzi-code/.
 */
function resolveSuperpowersPath(cwd: string): string | undefined {
  const candidates = [
    path.resolve(cwd, "tools/mcp-servers/superpowers/superpowers-mcp.js"),
    path.resolve(import.meta.dir, "../../../../../../tools/mcp-servers/superpowers/superpowers-mcp.js"),
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

function resolveInstalledEntrypoint(specifier: string): string | undefined {
  try {
    return require.resolve(specifier)
  } catch {
    return undefined
  }
}

function localServer(entrypoint: string | undefined): Config.Mcp | undefined {
  if (!entrypoint) return undefined
  return { type: "local", command: [process.execPath, entrypoint] }
}

/**
 * The Allternit connector MCP: per-user actions on connected apps
 * (list_apps / search_actions / get_action_guide / execute_action) via the
 * Rust API's internal route (`cmd/allternit-api/src/internal_routes.rs` →
 * connector_routes.rs mcp_proxy_internal). This is the last mile that makes
 * connected Gmail/Notion/Slack/etc. accounts callable BY the agent.
 *
 * Registered only when ALLTERNIT_INTERNAL_SERVICE_TOKEN matches the API's
 * (config.rs:302) — without it the entry would be a server that can only
 * 401. The route also requires the user explicitly; ALLTERNIT_USER_ID
 * overrides the local single-user default.
 */
function allternitConnectorsServer(): Config.Mcp | undefined {
  const token = process.env.ALLTERNIT_INTERNAL_SERVICE_TOKEN
  if (!token) return undefined
  const base = (process.env.ALLTERNIT_API_URL ?? "http://127.0.0.1:8013").replace(/\/$/, "")
  return {
    type: "remote",
    url: `${base}/internal/connectors/mcp`,
    headers: {
      // Static shared secret (internal_auth.rs — NOT a Bearer token).
      "x-allternit-internal-token": token,
      // The route also requires the user explicitly — the per-user
      // alias the connector proxy scopes connections by.
      "x-allternit-user-id": process.env.ALLTERNIT_USER_ID ?? "local-dev-user",
    },
    // The route authenticates by the static internal token, not OAuth —
    // skip gizzi's OAuth auto-detection.
    oauth: false,
  }
}

export function bundledMcpServers(options: { cwd?: string } = {}): Record<string, Config.Mcp> {
  const result: Record<string, Config.Mcp> = {}
  const sequentialThinking = localServer(
    resolveInstalledEntrypoint("@modelcontextprotocol/server-sequential-thinking/dist/index.js"),
  )
  const context7 = localServer(resolveInstalledEntrypoint("@upstash/context7-mcp/dist/index.js"))
  const superpowers = localServer(resolveSuperpowersPath(options.cwd ?? process.cwd()))

  if (sequentialThinking) result["sequential-thinking"] = sequentialThinking
  if (context7) result.context7 = context7
  if (superpowers) result.superpowers = superpowers

  const connectors = allternitConnectorsServer()
  if (connectors) result["allternit-connectors"] = connectors

  // Network-backed npx startup used to run unconditionally, causing two
  // independent startup timeouts and making a local CLI launch depend on npm.
  // Keep an explicit compatibility escape hatch for packaged installations
  // that do not ship these optional dependencies.
  if (process.env.GIZZI_ALLOW_NPX_BUNDLED_MCPS === "1") {
    result["sequential-thinking"] ??= {
      type: "local",
      command: ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
    }
    result.context7 ??= {
      type: "local",
      command: ["npx", "-y", "@upstash/context7-mcp"],
    }
  }

  return result
}

export const BUNDLED_MCP_SERVERS: Record<string, Config.Mcp> = bundledMcpServers()

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
    for (const [key, server] of Object.entries(bundledMcpServers())) {
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
