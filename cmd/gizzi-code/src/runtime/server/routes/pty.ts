// @ts-nocheck
import { Hono } from "hono"
import { upgradeWebSocket } from "hono/bun"
import { describeRoute, validator, resolver } from "@/runtime/server/openapi"
import z from "zod/v4"
import { Pty } from "@/runtime/integrations/pty"
import { errors } from "@/runtime/server/error"

const decoder = new TextDecoder()

// Adapt hono's WSContext to the minimal Socket shape Pty.connect expects. A
// unique connId is attached so Pty.connect's cross-connection guard works even
// if a client object were ever reused.
function toSocket(ws: any, connId: string) {
  return {
    readyState: 1,
    data: { connId },
    send: (data: string | Uint8Array | ArrayBuffer) => ws.send(data),
    close: (code?: number, reason?: string) => ws.close(code, reason),
  }
}

export const PtyRoutes = () =>
  new Hono()
    .get(
      "/list",
      describeRoute({
        summary: "List PTYs",
        description: "Retrieve a list of all active PTY (Pseudo-Terminal) sessions.",
        operationId: "pty.list",
        responses: {
          200: {
            description: "List of active PTYs",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
        },
      }),
      async (c) => {
        const ptys = await Pty.list()
        return c.json(ptys)
      },
    )
    .post(
      "/create",
      describeRoute({
        summary: "Create PTY",
        description: "Create a new PTY (Pseudo-Terminal) session.",
        operationId: "pty.create",
        responses: {
          200: {
            description: "Newly created PTY session",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", z.any()),
      async (c) => {
        const input = c.req.valid("json") as any
        const pty = await Pty.create(input)
        return c.json(pty)
      },
    )
    .get(
      "/:ptyID/connect",
      describeRoute({
        summary: "Connect to PTY (WebSocket)",
        description:
          "Upgrade to a WebSocket and attach to the PTY's live output. Replays scrollback first, then streams raw terminal output. Send text/binary messages to write input. Optional `cursor` query param is reserved for incremental scrollback resume.",
        operationId: "pty.connect",
        responses: {
          101: {
            description: "WebSocket upgrade",
          },
        },
      }),
      upgradeWebSocket((c) => {
        const ptyID = c.req.param("ptyID")
        const cursorParam = c.req.query("cursor")
        const cursor = cursorParam === undefined ? undefined : Number(cursorParam)
        const connId = `${ptyID}:${Date.now()}:${Math.random().toString(36).slice(2)}`
        let bridge: { onMessage?: (message: string | ArrayBuffer) => void; onClose?: () => void } | undefined
        return {
          async onOpen(_evt, ws) {
            bridge = await Pty.connect(ptyID, toSocket(ws, connId), Number.isFinite(cursor) ? cursor : undefined)
            if (!bridge) ws.close()
          },
          onMessage(evt) {
            if (!bridge?.onMessage) return
            const data = evt.data
            bridge.onMessage(typeof data === "string" ? data : decoder.decode(data as ArrayBuffer))
          },
          onClose() {
            bridge?.onClose?.()
          },
        }
      }),
    )
    .get(
      describeRoute({
        summary: "Get PTY details",
        description: "Retrieve detailed information about a specific PTY session by its ID.",
        operationId: "pty.get",
        responses: {
          200: {
            description: "PTY details",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.any()),
      async (c) => {
        const { ptyID } = c.req.valid("param") as any
        const pty = await Pty.get(ptyID)
        return c.json(pty)
      },
    )
    .put(
      "/:ptyID",
      describeRoute({
        summary: "Update PTY",
        description: "Update a PTY session — rename it or resize the terminal (size: { rows, cols }).",
        operationId: "pty.update",
        responses: {
          200: {
            description: "Updated PTY session",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.any()),
      validator("json", z.any()),
      async (c) => {
        const { ptyID } = c.req.valid("param") as any
        const input = c.req.valid("json") as any
        const pty = await Pty.update(ptyID, input)
        return c.json(pty)
      },
    )
    .delete(
      "/:ptyID",
      describeRoute({
        summary: "Kill PTY",
        description: "Terminate an active PTY (Pseudo-Terminal) session.",
        operationId: "pty.kill",
        responses: {
          200: {
            description: "PTY terminated successfully",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.any()),
      async (c) => {
        const { ptyID } = c.req.valid("param") as any
        await Pty.remove(ptyID)
        return c.json(true)
      },
    )
