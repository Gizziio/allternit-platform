// @ts-nocheck
/**
 * Remote Mode Command
 *
 * Manage connections to self-hosted Gizzi Code runners and remote
 * Allternit instances. Provides setup, connection testing, session
 * listing, and interactive remote sessions.
 *
 * Usage:
 *   gizzi remote list                — list active remote sessions
 *   gizzi remote connect <session>   — connect to a remote session
 *   gizzi remote setup               — configure remote runner connection
 *   gizzi remote status              — show remote runner status
 *   gizzi remote logs                — stream remote runner logs
 */

import type { CommandModule } from "yargs"
import { UI } from "@/cli/ui"
import { Log } from "@/shared/util/log"
import { Global } from "@/runtime/context/global"
import { Filesystem } from "@/shared/util/filesystem"
import path from "path"
import fs from "fs/promises"
import { existsSync } from "fs"

const log = Log.create({ service: "remote" })

export namespace RemoteConfig {
  export interface RunnerConfig {
    url: string
    token?: string
    name?: string
    timeout?: number
    reconnect?: boolean
    maxRetries?: number
  }

  function configPath(): string {
    return path.join(Global.Path.config, "remote.json")
  }

  export async function load(): Promise<RunnerConfig | null> {
    try {
      const text = await Filesystem.readText(configPath())
      if (!text) return null
      return JSON.parse(text) as RunnerConfig
    } catch {
      return null
    }
  }

  export async function save(config: RunnerConfig): Promise<void> {
    const dir = path.dirname(configPath())
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(configPath(), JSON.stringify(config, null, 2))
    log.info("saved remote config", { path: configPath() })
  }

  export async function remove(): Promise<void> {
    try {
      await fs.unlink(configPath())
    } catch {
      // Already gone
    }
  }

  /**
   * Resolve the remote URL from config or environment variables.
   */
  export function resolveUrl(): string | null {
    return (
      process.env.GIZZI_REMOTE_URL ??
      process.env.GIZZI_SELF_HOSTED_URL ??
      null
    )
  }

  /**
   * Resolve the remote auth token from config or environment variables.
   */
  export function resolveToken(): string | null {
    return (
      process.env.GIZZI_REMOTE_TOKEN ??
      process.env.GIZZI_SELF_HOSTED_TOKEN ??
      null
    )
  }
}

/**
 * Test connectivity to a remote runner.
 */
async function testConnection(url: string, token?: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now()
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (token) headers["Authorization"] = `Bearer ${token}`

    const response = await fetch(`${url}/api/health`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    })

    const latencyMs = Date.now() - start

    if (response.ok) {
      return { ok: true, latencyMs }
    }

    return { ok: false, latencyMs, error: `HTTP ${response.status}: ${response.statusText}` }
  } catch (e) {
    const latencyMs = Date.now() - start
    return {
      ok: false,
      latencyMs,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export const RemoteCommand: CommandModule = {
  command: "remote <action> [session]",
  describe: "manage remote runner connections and sessions",
  builder: (yargs) =>
    yargs
      .positional("action", {
        describe: "remote action",
        choices: ["list", "ls", "connect", "setup", "status", "test", "logs", "config"],
        type: "string",
        demandOption: true,
      })
      .positional("session", {
        describe: "session ID (for connect)",
        type: "string",
      })
      .option("url", {
        describe: "remote runner URL",
        type: "string",
      })
      .option("token", {
        describe: "authentication token",
        type: "string",
      })
      .option("timeout", {
        describe: "connection timeout in ms",
        type: "number",
        default: 30000,
      }),
  handler: async (argv) => {
    const action = argv.action as string
    const sessionId = argv.session as string | undefined

    try {
      switch (action) {
        case "list":
        case "ls": {
          const config = await RemoteConfig.load()
          const url = argv.url as string | undefined ?? config?.url ?? RemoteConfig.resolveUrl()
          const token = argv.token as string | undefined ?? config?.token ?? RemoteConfig.resolveToken()

          if (!url) {
            UI.error("No remote URL configured. Run `gizzi remote setup` first.")
            process.exit(1)
          }

          UI.info(`Listing sessions at ${url}...`)

          const headers: Record<string, string> = {}
          if (token) headers["Authorization"] = `Bearer ${token}`

          try {
            const response = await fetch(`${url}/api/sessions`, {
              headers,
              signal: AbortSignal.timeout(argv.timeout as number),
            })

            if (!response.ok) {
              UI.error(`Failed to list sessions: HTTP ${response.status}`)
              process.exit(1)
            }

            const sessions = await response.json() as Array<{
              id: string
              title: string
              status: string
              created: string
            }>

            if (sessions.length === 0) {
              UI.info("No active remote sessions.")
              return
            }

            UI.info(`${sessions.length} session(s):`)
            for (const s of sessions) {
              UI.info(`  ${s.id} — ${s.title ?? "(untitled)"} [${s.status}] (${s.created})`)
            }
          } catch (e) {
            UI.error(`Connection failed: ${e instanceof Error ? e.message : String(e)}`)
            process.exit(1)
          }
          break
        }

        case "connect": {
          if (!sessionId) {
            UI.error("Session ID required. Usage: gizzi remote connect <session-id>")
            process.exit(1)
          }

          const config = await RemoteConfig.load()
          const url = argv.url as string | undefined ?? config?.url ?? RemoteConfig.resolveUrl()

          if (!url) {
            UI.error("No remote URL configured. Run `gizzi remote setup` first.")
            process.exit(1)
          }

          UI.info(`Connecting to session ${sessionId} at ${url}...`)
          UI.info("Use Ctrl+C to disconnect.")

          // The actual WebSocket connection is handled by RemoteSessionManager
          // This command just validates config and delegates to the TUI thread
          break
        }

        case "setup": {
          const url = argv.url as string | undefined
          const token = argv.token as string | undefined

          if (!url) {
            UI.error("URL required. Usage: gizzi remote setup --url <url> [--token <token>]")
            process.exit(1)
          }

          UI.info(`Testing connection to ${url}...`)
          const result = await testConnection(url, token)

          if (!result.ok) {
            UI.error(`Connection failed: ${result.error}`)
            UI.info("Save anyway? The runner may not be running yet.")
          } else {
            UI.success(`Connected (${result.latencyMs}ms)`)
          }

          await RemoteConfig.save({
            url,
            ...(token ? { token } : {}),
            timeout: argv.timeout as number,
            reconnect: true,
            maxRetries: 3,
          })

          UI.success(`Remote runner configured at ${url}`)
          break
        }

        case "status": {
          const config = await RemoteConfig.load()
          const url = config?.url ?? RemoteConfig.resolveUrl()

          if (!url) {
            UI.info("No remote runner configured.")
            return
          }

          UI.info(`Remote runner: ${url}`)
          UI.info(`Timeout: ${config?.timeout ?? 30000}ms`)
          UI.info(`Reconnect: ${config?.reconnect ?? true}`)

          UI.info("Testing connection...")
          const result = await testConnection(url, config?.token ?? RemoteConfig.resolveToken())

          if (result.ok) {
            UI.success(`Connected (${result.latencyMs}ms)`)
          } else {
            UI.error(`Unreachable: ${result.error}`)
          }
          break
        }

        case "test": {
          const config = await RemoteConfig.load()
          const url = argv.url as string | undefined ?? config?.url ?? RemoteConfig.resolveUrl()
          const token = argv.token as string | undefined ?? config?.token ?? RemoteConfig.resolveToken()

          if (!url) {
            UI.error("No remote URL configured.")
            process.exit(1)
          }

          UI.info(`Testing ${url}...`)
          const result = await testConnection(url, token)

          if (result.ok) {
            UI.success(`Connection OK (${result.latencyMs}ms)`)
          } else {
            UI.error(`Failed: ${result.error}`)
            process.exit(1)
          }
          break
        }

        case "logs": {
          const config = await RemoteConfig.load()
          const url = config?.url ?? RemoteConfig.resolveUrl()

          if (!url) {
            UI.error("No remote URL configured.")
            process.exit(1)
          }

          UI.info(`Streaming logs from ${url} (Ctrl+C to stop)...`)

          const headers: Record<string, string> = {}
          const token = config?.token ?? RemoteConfig.resolveToken()
          if (token) headers["Authorization"] = `Bearer ${token}`

          try {
            const response = await fetch(`${url}/api/logs?stream=true`, {
              headers,
              signal: AbortSignal.timeout(300000),
            })

            if (!response.ok || !response.body) {
              UI.error(`Failed to stream logs: HTTP ${response.status}`)
              process.exit(1)
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()

            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              process.stdout.write(decoder.decode(value, { stream: true }))
            }
          } catch (e) {
            if (e instanceof Error && e.name === "AbortError") {
              UI.info("Log stream ended.")
            } else {
              UI.error(`Log stream failed: ${e instanceof Error ? e.message : String(e)}`)
              process.exit(1)
            }
          }
          break
        }

        case "config": {
          const config = await RemoteConfig.load()
          if (!config) {
            UI.info("No remote configuration found.")
            return
          }
          UI.info(JSON.stringify({ ...config, token: config.token ? "***" : undefined }, null, 2))
          break
        }

        default:
          UI.error(`Unknown action: ${action}`)
          process.exit(1)
      }
    } catch (e) {
      UI.error(e instanceof Error ? e.message : String(e))
      process.exit(1)
    }
  },
}
