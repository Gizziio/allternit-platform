import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { describeRoute, resolver } from "@/runtime/server/openapi"
import { Bus } from "@/shared/bus"
import { BusEvent } from "@/shared/bus/bus-event"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "route-event" })

export function EventRoutes() {
  return new Hono().get(
    "/",
    describeRoute({
      summary: "Subscribe to events",
      description: "Get events",
      operationId: "event.subscribe",
      responses: {
        200: {
          description: "Event stream",
          content: {
            "text/event-stream": {
              schema: resolver(BusEvent.payloads()),
            },
          },
        },
      },
    }),
    async (c) => {
      log.info("event connected")
      c.header("X-Accel-Buffering", "no")
      c.header("X-Content-Type-Options", "nosniff")
      return streamSSE(c, async (stream) => {
        stream.writeSSE({
          data: JSON.stringify({
            type: "server.connected",
            properties: {},
          }),
        })
        const unsub = Bus.subscribeAll(async (event) => {
          await stream.writeSSE({
            data: JSON.stringify(event),
          })
          if (event.type === Bus.InstanceDisposed.type) {
            stream.close()
          }
        })

        const heartbeat = setInterval(() => {
          stream.writeSSE({
            data: JSON.stringify({
              type: "server.heartbeat",
              properties: {},
            }),
          })
        }, 10_000)

        await new Promise<void>((resolve) => {
          stream.onAbort(() => {
            clearInterval(heartbeat)
            unsub()
            resolve()
            log.info("event disconnected")
          })
        })
      })
    },
  )
}
