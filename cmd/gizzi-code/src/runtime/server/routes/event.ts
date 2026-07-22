// @ts-nocheck
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
      // Standard SSE reconnect: browsers automatically resend the last
      // received `id:` as `Last-Event-ID` when EventSource reconnects after
      // a drop. Accept a `?since=` query param too for non-browser clients
      // (e.g. the allternit-api proxy) that can't rely on that header alone.
      const lastEventId = c.req.header("Last-Event-ID") ?? c.req.query("since")
      const sinceSeq = lastEventId ? Number(lastEventId) : NaN
      log.info("event connected", { sinceSeq: Number.isFinite(sinceSeq) ? sinceSeq : undefined })
      c.header("X-Accel-Buffering", "no")
      c.header("X-Content-Type-Options", "nosniff")
      return streamSSE(c, async (stream) => {
        if (Number.isFinite(sinceSeq) && sinceSeq > 0) {
          for (const { seq, event } of Bus.historySince(sinceSeq)) {
            await stream.writeSSE({
              id: String(seq),
              data: JSON.stringify(event),
            })
          }
        }

        stream.writeSSE({
          id: String(Bus.currentSeq()),
          data: JSON.stringify({
            type: "server.connected",
            properties: {},
          }),
        })
        const unsub = Bus.subscribeAll(async (event) => {
          const seq = Bus.currentSeq()
          await stream.writeSSE({
            id: String(seq),
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
