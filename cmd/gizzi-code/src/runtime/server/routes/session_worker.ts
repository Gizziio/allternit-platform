/**
 * Session worker routes — capability-native harness access.
 *
 * This module exposes the durable session harness as worker functions that can
 * be invoked over the Fabric. It replaces the remote-control abstraction with
 * typed capability invocations:
 *
 *   harness.session           → list/get sessions
 *   harness.session.message   → send a message and start the agent loop
 *   harness.session.abort     → cancel the running agent loop
 *   harness.session.events    → stream session observations
 *
 * A generic /invoke endpoint accepts { capability, inputs, lease? } so the
 * scheduler can dispatch any capability without path-specific logic.
 */
import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { describeRoute, validator, resolver } from "@/runtime/server/openapi"
import { errors } from "@/runtime/server/error"
import z from "zod/v4"
import { Session } from "@/runtime/session"
import { MessageV2 } from "@/runtime/session/message-v2"
import { SessionPrompt } from "@/runtime/session/prompt"
import { SessionStatus } from "@/runtime/session/status"
import { Bus } from "@/shared/bus"
import { Log } from "@/shared/util/log"
import { lazy } from "@/shared/util/lazy"
import { PermissionNext } from "@/runtime/tools/guard/permission/next"
import { Question } from "@/runtime/integrations/question"
import { LeaseCheck } from "@/runtime/server/middleware/lease-check"
import { CapabilityExecutors } from "@/runtime/fabric/executor"
import { buildNodeIdentity } from "@/runtime/fabric/capability-catalog"
import { randomUUID } from "node:crypto"

const log = Log.create({ service: "session-worker" })

const CapabilityInvocation = z.object({
  capability: z.string().min(1),
  inputs: z.record(z.string(), z.unknown()).default({}),
})

const SessionStatusInfo = z.object({
  session: Session.Info,
  status: SessionStatus.Info,
})

export const SessionWorkerRoutes = lazy(() =>
  new Hono()
    .use(LeaseCheck.enforce())
    .post(
      "/invoke",
      describeRoute({
        summary: "Invoke a capability",
        description: "Generic worker invocation for any harness capability.",
        operationId: "sessionWorker.invoke",
        responses: {
          200: { description: "Invocation result", content: { "application/json": { schema: resolver(z.any()) } } },
          ...errors(400, 404),
        },
      }),
      validator("json", CapabilityInvocation),
      async (c) => {
        const body = c.req.valid("json")
        const base = new URL(c.req.url)
        const node = buildNodeIdentity({
          endpoints: [{ transport: "local", url: `${base.protocol}//${base.host}`, priority: 0 }],
        })
        const result = await CapabilityExecutors.dispatch(body.capability, body.inputs, {
          requestId: c.get("requestID") ?? randomUUID(),
          node,
          lease: c.get("fabricLease"),
        })
        if (result.ok) {
          return c.json(result)
        }
        const status = result.error.startsWith("lease_") ? 403 : 501
        return c.json(result, status as any)
      },
    )
    .get(
      "/sessions",
      describeRoute({
        summary: "List sessions",
        description: "List non-archived sessions with their current busy/idle status.",
        operationId: "sessionWorker.sessions.list",
        responses: {
          200: {
            description: "List of sessions and statuses",
            content: { "application/json": { schema: resolver(z.array(SessionStatusInfo)) } },
          },
        },
      }),
      async (c) => {
        const sessions = Array.from(Session.list()).filter((s) => s.time.archived === undefined)
        const result = sessions.map((session) => ({
          session,
          status: SessionStatus.get(session.id),
        }))
        return c.json(result)
      },
    )
    .get(
      "/sessions/:sessionID",
      describeRoute({
        summary: "Get a session",
        description: "Return session metadata, status, and full message history.",
        operationId: "sessionWorker.session.get",
        responses: {
          200: { description: "Session details and messages", content: { "application/json": { schema: resolver(z.any()) } } },
          ...errors(404),
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const session = await Session.get(sessionID)
        const messages = await Session.messages({ sessionID })
        return c.json({
          session,
          status: SessionStatus.get(sessionID),
          messages,
        })
      },
    )
    .post(
      "/sessions/:sessionID/messages",
      describeRoute({
        summary: "Send a session message",
        description: "Append a user message to a session and start the agent loop.",
        operationId: "sessionWorker.session.message",
        responses: {
          200: {
            description: "The created user message and accepted status",
            content: { "application/json": { schema: resolver(z.any()) } },
          },
          ...errors(400, 404, 409),
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      validator(
        "json",
        z.object({
          text: z.string().min(1),
          attachments: z
            .array(
              z.object({
                mime: z.string(),
                url: z.string(),
                filename: z.string().optional(),
              }),
            )
            .optional(),
        }),
      ),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const body = c.req.valid("json")
        await Session.get(sessionID)

        const parts: SessionPrompt.PromptInput["parts"] = [{ type: "text", text: body.text }]
        for (const attachment of body.attachments ?? []) {
          parts.push({
            type: "file",
            mime: attachment.mime,
            url: attachment.url,
            filename: attachment.filename,
          })
        }

        SessionPrompt.prompt({ sessionID, parts })
        return c.json({ accepted: true, sessionID, capability: "harness.session.message" })
      },
    )
    .post(
      "/sessions/:sessionID/abort",
      describeRoute({
        summary: "Abort a session",
        description: "Cancel the running agent loop for a session.",
        operationId: "sessionWorker.session.abort",
        responses: {
          200: { description: "Abort signalled", content: { "application/json": { schema: resolver(z.boolean()) } } },
          ...errors(404),
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        await Session.get(sessionID)
        SessionPrompt.cancel(sessionID)
        return c.json(true)
      },
    )
    .get(
      "/sessions/:sessionID/events",
      describeRoute({
        summary: "Stream session events",
        description:
          "Server-sent events for a single session: metadata changes, new messages, part updates, and status changes. Requires a `harness.session.events` lease when lease enforcement is enabled.",
        operationId: "sessionWorker.session.events",
        responses: {
          200: { description: "SSE stream", content: { "text/event-stream": { schema: resolver(z.any()) } } },
          ...errors(403, 404),
        },
      }),
      LeaseCheck.requireCapability("harness.session.events"),
      validator("param", z.object({ sessionID: z.string() })),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        await Session.get(sessionID)

        c.header("X-Accel-Buffering", "no")
        c.header("X-Content-Type-Options", "nosniff")

        return streamSSE(c, async (stream) => {
          const writeEvent = async (event: { type: string; properties: any }) => {
            await stream.writeSSE({ data: JSON.stringify(event) })
          }

          await writeEvent({
            type: "session-worker.connected",
            properties: { sessionID, status: SessionStatus.get(sessionID) },
          })

          const unsubs: (() => void)[] = []
          unsubs.push(
            Bus.subscribe(Session.Event.Updated, (event) => {
              if (event.properties.info.id === sessionID) return writeEvent(event)
            }),
            Bus.subscribe(MessageV2.Event.Updated, (event) => {
              if (event.properties.info.sessionID === sessionID) return writeEvent(event)
            }),
            Bus.subscribe(MessageV2.Event.PartUpdated, (event) => {
              if (event.properties.part.sessionID === sessionID) return writeEvent(event)
            }),
            Bus.subscribe(SessionStatus.Event.Status, (event) => {
              if (event.properties.sessionID === sessionID) return writeEvent(event)
            }),
            Bus.subscribe(PermissionNext.Event.Asked, (event) => {
              if (event.properties.sessionID === sessionID) return writeEvent(event)
            }),
            Bus.subscribe(Question.Event.Asked, (event) => {
              if (event.properties.sessionID === sessionID) return writeEvent(event)
            }),
          )

          const heartbeat = setInterval(() => {
            stream.writeSSE({
              data: JSON.stringify({ type: "session-worker.heartbeat", properties: { sessionID } }),
            })
          }, 10_000)

          await new Promise<void>((resolve) => {
            stream.onAbort(() => {
              clearInterval(heartbeat)
              for (const unsub of unsubs) unsub()
              resolve()
              log.info("session worker events disconnected", { sessionID })
            })
          })
        })
      },
    ),
)
