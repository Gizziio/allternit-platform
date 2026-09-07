// @ts-nocheck
/**
 * ACP (Agent Connection Protocol) Server Routes
 * 
 * Provides HTTP endpoints for the platform to:
 * - Spawn ACP agents
 * - Manage ACP connections
 * - Send prompts to ACP agents
 */

import { Hono } from "hono"
import { describeRoute, validator, resolver } from "@/runtime/server/openapi"
import z from "zod/v4"
import { errors } from "@/runtime/server/error"
import { lazy } from "@/runtime/util/lazy"
import { Log } from "@/runtime/util/log"
import { spawn } from "child_process"
import { Readable, Writable } from "node:stream"
import { ClientSideConnection, PROTOCOL_VERSION, ndJsonStream } from "@agentclientprotocol/sdk"
import { PermissionNext } from "@/runtime/tools/guard/permission/next"
import { Identifier } from "@/shared/id/id"

const log = Log.create({ service: "acp-server-routes" })

// Active connections store
interface ActiveConnection {
  id: string
  agentId: string
  agentName: string
  process?: ReturnType<typeof spawn>
  status: "connecting" | "connected" | "error" | "disconnected"
  capabilities?: {
    tools: string[]
    prompts: string[]
    resources: string[]
  }
  sessionId?: string
  pid?: number
  createdAt: Date
  lastActivity: Date
  error?: string
  acp?: ClientSideConnection
  updates?: unknown[]
  permissions?: Map<string, { request: any; resolve: (response: any) => void }>
  permissionSessionId?: string
}

const connections = new Map<string, ActiveConnection>()

export const AcpRoutes = lazy(() =>
  new Hono()
    // Health check
    .get(
      "/health",
      describeRoute({
        summary: "ACP Health Check",
        description: "Check the status of the ACP server and active connections.",
        operationId: "acp.health",
        responses: {
          200: {
            description: "Health status",
            content: {
              "application/json": {
                schema: resolver(z.object({ status: z.string(), connections: z.number() })),
              },
            },
          },
        },
      }),
      (c) => {
        return c.json({ status: "ok", connections: connections.size })
      },
    )

    // Spawn ACP agent
    .post(
      "/spawn",
      describeRoute({
        summary: "Spawn ACP Agent",
        description: "Spawn a new ACP (Agent Connection Protocol) agent process.",
        operationId: "acp.spawn",
        responses: {
          201: {
            description: "Agent spawned successfully",
            content: {
              "application/json": {
                schema: resolver(z.object({
                  success: z.boolean(),
                  connectionId: z.string(),
                  pid: z.number(),
                  sessionId: z.string(),
                  capabilities: z.object({
                    tools: z.array(z.string()),
                    prompts: z.array(z.string()),
                    resources: z.array(z.string()),
                  }),
                })),
              },
            },
          },
          ...errors(400, 409, 500),
        },
      }),
      validator("json", z.object({
        agentId: z.string(),
        agentName: z.string().optional(),
        command: z.string(),
        args: z.array(z.string()).optional(),
        env: z.record(z.string(), z.string()).optional(),
        cwd: z.string().optional(),
      })),
      async (c) => {
        try {
          const body = c.req.valid("json")
          const { agentId, agentName, command, args, env, cwd } = body

          log.info("spawning_acp_agent", { agentId, agentName, command })

          // Check if already connected
          const existing = Array.from(connections.values()).find(
            (conn) => conn.agentId === agentId && conn.status === "connected",
          )

          if (existing) {
            return c.json(
              {
                success: false,
                error: "Agent already connected",
                connectionId: existing.id,
              },
              409,
            )
          }

          // Create connection record
          const connectionId = `acp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          const connection: ActiveConnection = {
            id: connectionId,
            agentId,
            agentName: agentName || agentId,
            status: "connecting",
            createdAt: new Date(),
            lastActivity: new Date(),
          }

          connections.set(connectionId, connection)

          // Spawn the process
          const spawnResult = await spawnAcpAgentSdk({
            connectionId,
            connection,
            command,
            args: args || [],
            env: env || {},
            cwd,
          })

          if (!spawnResult.success) {
            connection.status = "error"
            connection.error = spawnResult.error
            return c.json({ success: false, error: spawnResult.error }, 500)
          }

          connection.status = "connected"
          connection.pid = spawnResult.pid
          connection.sessionId = spawnResult.sessionId
          connection.capabilities = spawnResult.capabilities
          connection.lastActivity = new Date()

          log.info("acp_agent_connected", {
            connectionId,
            agentId,
            pid: spawnResult.pid,
          })

          return c.json({
            success: true,
            connectionId,
            pid: spawnResult.pid,
            sessionId: spawnResult.sessionId,
            capabilities: spawnResult.capabilities,
          }, 201)
        } catch (error) {
          log.error("spawn_failed", { error })
          return c.json(
            { success: false, error: error instanceof Error ? error.message : "Spawn failed" },
            500,
          )
        }
      },
    )

    // List connections
    .get(
      "/connections",
      describeRoute({
        summary: "List ACP Connections",
        description: "List all active ACP agent connections.",
        operationId: "acp.listConnections",
        responses: {
          200: {
            description: "List of connections",
            content: {
              "application/json": {
                schema: resolver(z.object({
                  connections: z.array(z.object({
                    id: z.string(),
                    agentId: z.string(),
                    agentName: z.string(),
                    status: z.string(),
                    pid: z.number().optional(),
                    sessionId: z.string().optional(),
                    capabilities: z.any(),
                    createdAt: z.string(),
                    lastActivity: z.string(),
                  })),
                })),
              },
            },
          },
        },
      }),
      (c) => {
        const activeConnections = Array.from(connections.values()).map((conn) => ({
          id: conn.id,
          agentId: conn.agentId,
          agentName: conn.agentName,
          status: conn.status,
          pid: conn.pid,
          sessionId: conn.sessionId,
          capabilities: conn.capabilities,
          createdAt: conn.createdAt.toISOString(),
          lastActivity: conn.lastActivity.toISOString(),
          error: conn.error,
        }))

        return c.json({ connections: activeConnections })
      },
    )

    // Get connection details
    .get(
      "/connections/:id",
      describeRoute({
        summary: "Get ACP Connection",
        description: "Get details of a specific ACP connection.",
        operationId: "acp.getConnection",
        responses: {
          200: {
            description: "Connection details",
            content: { "application/json": { schema: resolver(z.any()) } },
          },
          ...errors(404),
        },
      }),
      (c) => {
        const id = c.req.param("id")
        const connection = connections.get(id)

        if (!connection) {
          return c.json({ error: "Connection not found" }, 404)
        }

        return c.json({
          id: connection.id,
          agentId: connection.agentId,
          agentName: connection.agentName,
          status: connection.status,
          pid: connection.pid,
          sessionId: connection.sessionId,
          capabilities: connection.capabilities,
          createdAt: connection.createdAt.toISOString(),
          lastActivity: connection.lastActivity.toISOString(),
          error: connection.error,
        })
      },
    )

    // Disconnect agent
    .post(
      "/connections/:id/disconnect",
      describeRoute({
        summary: "Disconnect ACP Agent",
        description: "Disconnect and terminate an ACP agent.",
        operationId: "acp.disconnect",
        responses: {
          200: { description: "Disconnected successfully" },
          ...errors(404, 500),
        },
      }),
      (c) => {
        const id = c.req.param("id")
        const connection = connections.get(id)

        if (!connection) {
          return c.json({ error: "Connection not found" }, 404)
        }

        try {
          if (connection.process) {
            connection.process.kill("SIGTERM")

            setTimeout(() => {
              if (connection.process && !connection.process.killed) {
                connection.process.kill("SIGKILL")
              }
            }, 5000)
          }

          connection.status = "disconnected"
          connections.delete(id)

          log.info("acp_agent_disconnected", { connectionId: id })

          return c.json({ success: true })
        } catch (error) {
          log.error("disconnect_failed", { error, connectionId: id })
          return c.json({ error: "Failed to disconnect" }, 500)
        }
      },
    )

    // Send prompt
    .post(
      "/connections/:id/prompt",
      describeRoute({
        summary: "Send Prompt to ACP Agent",
        description: "Send a prompt to a connected ACP agent.",
        operationId: "acp.prompt",
        responses: {
          200: { description: "Prompt sent successfully" },
          ...errors(400, 404),
        },
      }),
      validator("json", z.object({
        prompt: z.string(),
        context: z.record(z.string(), z.unknown()).optional(),
      })),
      async (c) => {
        const id = c.req.param("id")
        const connection = connections.get(id)
        const body = c.req.valid("json")

        if (!connection) {
          return c.json({ error: "Connection not found" }, 404)
        }

        if (connection.status !== "connected") {
          return c.json({ error: "Connection not active" }, 400)
        }

        try {
          const { prompt } = body
          connection.lastActivity = new Date()

          if (!connection.acp || !connection.sessionId) return c.json({ error: "ACP session unavailable" }, 400)
          connection.updates = []
          const result = await connection.acp.prompt({
            sessionId: connection.sessionId,
            prompt: [{ type: "text", text: prompt }],
          })

          return c.json({
            success: true,
            stopReason: result.stopReason,
            updates: connection.updates,
            sessionId: connection.sessionId,
          })
        } catch (error) {
          log.error("prompt_failed", { error, connectionId: id })
          return c.json({ error: "Failed to send prompt" }, 500)
        }
      },
    )
    .post("/connections/:id/v1/chat/completions", async (c) => {
      const connection = connections.get(c.req.param("id"))
      if (!connection?.acp || !connection.sessionId) return c.json({ error: { message: "ACP connection unavailable" } }, 404)
      const body = await c.req.json().catch(() => ({})) as { messages?: Array<{ role?: string; content?: string }> }
      const prompt = [...(body.messages ?? [])].reverse().find((message) => message.role === "user")?.content
      if (!prompt) return c.json({ error: { message: "A user message is required" } }, 400)
      connection.updates = []
      const result = await connection.acp.prompt({ sessionId: connection.sessionId, prompt: [{ type: "text", text: prompt }] })
      const text = (connection.updates ?? []).flatMap((notification: any) => {
        const update = notification?.update
        return update?.sessionUpdate === "agent_message_chunk" && update.content?.type === "text" ? [update.content.text] : []
      }).join("")
      return c.json({
        id: `acp-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: connection.agentId,
        choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: result.stopReason ?? "stop" }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      })
    })
    .get("/connections/:id/permissions", (c) => {
      const connection = connections.get(c.req.param("id"))
      if (!connection) return c.json({ error: "Connection not found" }, 404)
      return c.json({ permissions: [...(connection.permissions ?? new Map()).entries()].map(([id, value]) => ({ id, ...value.request })) })
    })
    .post("/connections/:id/permissions/:permissionId", async (c) => {
      const pending = connections.get(c.req.param("id"))?.permissions?.get(c.req.param("permissionId"))
      if (!pending) return c.json({ error: "Permission request not found" }, 404)
      const body = await c.req.json().catch(() => ({})) as { optionId?: string; cancelled?: boolean }
      pending.resolve({ outcome: body.cancelled || !body.optionId ? { outcome: "cancelled" } : { outcome: "selected", optionId: body.optionId } })
      connections.get(c.req.param("id"))?.permissions?.delete(c.req.param("permissionId"))
      return c.json({ success: true })
    }),
)

async function spawnAcpAgentSdk({ connectionId, connection, command, args, env, cwd }: {
  connectionId: string
  connection: ActiveConnection
  command: string
  args: string[]
  env: Record<string, string>
  cwd?: string
}): Promise<{ success: boolean; pid?: number; sessionId?: string; capabilities?: { tools: string[]; prompts: string[]; resources: string[] }; error?: string }> {
  try {
    const proc = spawn(command, args, { env: { ...process.env, ...env }, cwd: cwd || process.cwd(), stdio: ["pipe", "pipe", "pipe"] })
    connection.process = proc
    connection.updates = []
    connection.permissions = new Map()
    connection.permissionSessionId = Identifier.ascending("session")
    proc.stderr?.on("data", (data: Buffer) => log.warn("acp_agent_stderr", { connectionId, data: data.toString().slice(0, 500) }))

    const stream = ndJsonStream(
      Writable.toWeb(proc.stdin!) as WritableStream<Uint8Array>,
      Readable.toWeb(proc.stdout!) as ReadableStream<Uint8Array>,
    )
    const client = {
      async sessionUpdate(params: unknown) { connection.lastActivity = new Date(); connection.updates?.push(params) },
      async requestPermission(request: any) {
        const title = String(request.toolCall?.title ?? request.toolCall?.kind ?? "ACP tool")
        const kind = String(request.toolCall?.kind ?? "tool")
        const readonly = new Set(["read", "search", "fetch", "list", "inspect"])
        const ruleset = PermissionNext.fromConfig({ "*": "ask", ...(readonly.has(kind) ? { acp: "allow" } : {}) } as any)
        try {
          const requestID = Identifier.ascending("permission")
          const approval = PermissionNext.ask({
            id: requestID,
            sessionID: connection.permissionSessionId!,
            permission: "acp",
            patterns: [kind],
            metadata: { source: "mini-app-acp", connectionId, agentId: connection.agentId, title, toolCall: request.toolCall },
            always: [kind],
            ruleset,
          })
          const timeout = setTimeout(() => {
            void PermissionNext.reply({ requestID, reply: "reject", message: "Approval timed out" })
          }, 120_000)
          await approval.finally(() => clearTimeout(timeout))
          const option = request.options?.find((item: any) => item.kind === "allow_once")
            ?? request.options?.find((item: any) => item.kind === "allow_always")
            ?? request.options?.find((item: any) => !String(item.kind).includes("reject"))
          return option ? { outcome: { outcome: "selected" as const, optionId: option.optionId } } : { outcome: { outcome: "cancelled" as const } }
        } catch {
          return { outcome: { outcome: "cancelled" as const } }
        }
      },
      async readTextFile() { throw new Error("ACP file reads require an Allternit workspace grant") },
      async writeTextFile() { throw new Error("ACP file writes require an Allternit workspace grant") },
    }
    const acp = new ClientSideConnection(() => client as any, stream)
    connection.acp = acp
    const initialized = await acp.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
      clientInfo: { name: "Allternit", version: "1.0.0" },
    })
    const session = await acp.newSession({ cwd: cwd || process.cwd(), mcpServers: [] })
    connection.sessionId = session.sessionId
    proc.once("exit", () => { connection.status = "disconnected" })
    return {
      success: true,
      pid: proc.pid || 0,
      sessionId: session.sessionId,
      capabilities: {
        tools: initialized.agentCapabilities?.mcpCapabilities ? ["mcp"] : [],
        prompts: ["session/prompt"],
        resources: [],
      },
    }
  } catch (error) {
    try { connection.process?.kill("SIGTERM") } catch { /* process may already have exited */ }
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// Spawn helper
async function spawnAcpAgent({
  connectionId,
  connection,
  command,
  args,
  env,
  cwd,
}: {
  connectionId: string
  connection: ActiveConnection
  command: string
  args: string[]
  env: Record<string, string>
  cwd?: string
}): Promise<{
  success: boolean
  pid?: number
  sessionId?: string
  capabilities?: { tools: string[]; prompts: string[]; resources: string[] }
  error?: string
}> {
  return new Promise((resolve) => {
    try {
      const spawnEnv = {
        ...process.env,
        ...env,
        ACP_CONNECTION_ID: connectionId,
        ACP_SESSION_ID: `session-${Date.now()}`,
      }

      const proc = spawn(command, args, {
        env: spawnEnv,
        cwd: cwd || process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      })

      connection.process = proc

      let stdoutBuffer = ""
      let initialized = false

      proc.stdout?.on("data", (data: Buffer) => {
        stdoutBuffer += data.toString()
        connection.lastActivity = new Date()

        if (!initialized) {
          try {
            const lines = stdoutBuffer.split("\n")
            for (const line of lines) {
              if (line.trim()) {
                const msg = JSON.parse(line)
                if (msg.result?.protocolVersion) {
                  initialized = true
                  connection.sessionId = spawnEnv.ACP_SESSION_ID
                  connection.capabilities = {
                    tools: msg.result.agentCapabilities?.tools || [],
                    prompts: msg.result.agentCapabilities?.prompts || [],
                    resources: msg.result.agentCapabilities?.resources || [],
                  }

                  resolve({
                    success: true,
                    pid: proc.pid || 0,
                    sessionId: connection.sessionId,
                    capabilities: connection.capabilities,
                  })
                }
              }
            }
          } catch {
            // Not valid JSON yet
          }
        }
      })

      proc.stderr?.on("data", (data: Buffer) => {
        log.warn("acp_agent_stderr", {
          connectionId,
          data: data.toString().substring(0, 500),
        })
      })

      proc.on("exit", (code) => {
        if (!initialized) {
          resolve({
            success: false,
            error: `Process exited with code ${code} before initialization`,
          })
        } else {
          connection.status = "disconnected"
        }
      })

      proc.on("error", (err) => {
        if (!initialized) {
          resolve({
            success: false,
            error: `Process error: ${err.message}`,
          })
        }
      })

      // Send initialize request
      const initRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "1",
          clientCapabilities: {
            tools: { listChanged: true },
            prompts: { listChanged: true },
          },
          clientInfo: {
            name: "Allternit",
            version: "1.0.0",
          },
        },
      }

      proc.stdin?.write(JSON.stringify(initRequest) + "\n")

      // Timeout
      setTimeout(() => {
        if (!initialized) {
          proc.kill("SIGTERM")
          resolve({ success: false, error: "Initialization timeout" })
        }
      }, 30000)
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : "Spawn failed",
      })
    }
  })
}

export { connections }
