import { Hono } from "hono"
import { describeRoute, resolver, validator } from "@/runtime/server/openapi"
import { streamSSE } from "hono/streaming"
import z from "zod/v4"
import { BusEvent } from "@/shared/bus/bus-event"
import { GlobalBus } from "@/shared/bus/global"
import { Instance } from "@/runtime/context/project/instance"
import { Installation } from "@/shared/installation"
import { Log } from "@/shared/util/log"
import { lazy } from "@/shared/util/lazy"
import { Config } from "@/runtime/context/config/config"
import { errors } from "@/runtime/server/error"

const log = Log.create({ service: "server" })

export const GlobalDisposedEvent = BusEvent.define("global.disposed", z.object({}))

export const GlobalRoutes = lazy(() =>
  new Hono()
    .get(
      "/health",
      describeRoute({
        summary: "Get health",
        description: "Get health information about the GIZZI server.",
        operationId: "global.health",
        responses: {
          200: {
            description: "Health information",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json({ healthy: true, version: Installation.VERSION })
      },
    )
    .get(
      "/event",
      describeRoute({
        summary: "Get global events",
        description: "Subscribe to global events from the GIZZI system using server-sent events.",
        operationId: "global.event",
        responses: {
          200: {
            description: "Event stream",
            content: {
              "text/event-stream": {
                schema: resolver(
                  z.object({
                    directory: z.string(),
                    payload: BusEvent.payloads(),
                  })
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        log.info("global event connected")
        c.header("X-Accel-Buffering", "no")
        c.header("X-Content-Type-Options", "nosniff")
        return streamSSE(c, async (stream) => {
          stream.writeSSE({
            data: JSON.stringify({
              payload: {
                type: "server.connected",
                properties: {},
              },
            }),
          })
          async function handler(event: any) {
            await stream.writeSSE({
              data: JSON.stringify(event),
            })
          }
          GlobalBus.on("event", handler)

          // Send heartbeat every 10s to prevent stalled proxy streams.
          const heartbeat = setInterval(() => {
            stream.writeSSE({
              data: JSON.stringify({
                payload: {
                  type: "server.heartbeat",
                  properties: {},
                },
              }),
            })
          }, 10_000)

          await new Promise<void>((resolve) => {
            stream.onAbort(() => {
              clearInterval(heartbeat)
              GlobalBus.off("event", handler)
              resolve()
              log.info("global event disconnected")
            })
          })
        })
      },
    )
    .get(
      "/version",
      describeRoute({
        summary: "Get version",
        description: "Get the current version of the GIZZI system.",
        operationId: "global.version",
        responses: {
          200: {
            description: "Version information",
            content: {
              "application/json": {
                schema: resolver(z.any()),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json({ version: Installation.VERSION })
      },
    ),
)
