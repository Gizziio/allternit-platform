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
        env: z.record(z.string()).optional(),
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
          const spawnResult = await spawnAcpAgent({
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
        context: z.record(z.unknown()).optional(),
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

          // Send prompt via stdin
          if (connection.process?.stdin) {
            const message = {
              jsonrpc: "2.0",
              id: Date.now(),
              method: "prompt",
              params: { prompt },
            }
            connection.process.stdin.write(JSON.stringify(message) + "\n")
          }

          return c.json({
            success: true,
            message: "Prompt sent",
            sessionId: connection.sessionId,
          })
        } catch (error) {
          log.error("prompt_failed", { error, connectionId: id })
          return c.json({ error: "Failed to send prompt" }, 500)
        }
      },
    ),
)

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
