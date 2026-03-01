import { Hono } from "hono"
import { stream } from "hono/streaming"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod/v4"
import { Session } from "../../session"
import { MessageV2 } from "../../session/message-v2"
import { SessionPrompt } from "../../session/prompt"
import { SessionCompaction } from "../../session/compaction"
import { SessionRevert } from "../../session/revert"
import { SessionStatus } from "@/session/status"
import { RunRegistry } from "@/runtime/run-registry"
import { SessionSummary } from "@/session/summary"
import { Todo } from "../../session/todo"
import { Agent } from "../../agent/agent"
import { Snapshot } from "@/snapshot"
import { Log } from "../../util/log"
import { PermissionNext } from "@/permission/next"
import { Bus } from "@/bus"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { buildReasoningTrace } from "./reasoning-trace"

const log = Log.create({ service: "server" })

type PlanStepStatus = "pending" | "in-progress" | "complete" | "error"

type StreamPlanStep = {
  id: string
  description: string
  status: PlanStepStatus
}

type SearchSourceCandidate = {
  title: string
  url: string
  text: string
}

function parseStructuredValue(value: unknown): unknown {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  if (!trimmed) return value

  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return value
    }
  }

  return value
}

function humanizeToolLabel(toolID: string): string {
  return toolID
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function summarizeToolInput(input: unknown): string | undefined {
  const parsed = parseStructuredValue(input)

  if (typeof parsed === "string") {
    const trimmed = parsed.trim()
    return trimmed ? trimmed.slice(0, 120) : undefined
  }

  if (!parsed || typeof parsed !== "object") {
    return undefined
  }

  const record = parsed as Record<string, unknown>
  for (const key of ["query", "url", "path", "goal", "task", "prompt", "question"]) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 120)
    }
  }

  return undefined
}

function inferSourceTitle(url: string, fallback?: string): string {
  if (fallback && fallback.trim()) return fallback.trim()
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function extractSearchSources(result: unknown): SearchSourceCandidate[] {
  const seen = new Set<string>()
  const sources: SearchSourceCandidate[] = []

  const visit = (value: unknown) => {
    const parsed = parseStructuredValue(value)

    if (Array.isArray(parsed)) {
      parsed.forEach(visit)
      return
    }

    if (!parsed || typeof parsed !== "object") {
      return
    }

    const record = parsed as Record<string, unknown>
    const url = typeof record.url === "string" ? record.url.trim() : ""
    const title = typeof record.title === "string" ? record.title.trim() : ""
    const textCandidate = [
      record.content,
      record.snippet,
      record.extracted_content,
      record.description,
      record.text,
    ].find((candidate) => typeof candidate === "string" && candidate.trim()) as string | undefined

    if (url && !seen.has(url) && (title || textCandidate)) {
      seen.add(url)
      sources.push({
        title: inferSourceTitle(url, title),
        url,
        text: (textCandidate ?? title).trim().slice(0, 220),
      })
    }

    for (const nestedKey of ["results", "items", "sources", "documents", "citations"]) {
      if (Array.isArray(record[nestedKey])) {
        visit(record[nestedKey])
      }
    }
  }

  visit(result)
  return sources
}

function extractToolSources(input: unknown, result: unknown): SearchSourceCandidate[] {
  const extracted = extractSearchSources(result)
  if (extracted.length > 0) return extracted

  const parsedInput = parseStructuredValue(input)
  if (!parsedInput || typeof parsedInput !== "object") {
    return extracted
  }

  const inputRecord = parsedInput as Record<string, unknown>
  const url = typeof inputRecord.url === "string" ? inputRecord.url.trim() : ""
  if (!url) {
    return extracted
  }

  const parsedResult = parseStructuredValue(result)
  const resultRecord =
    parsedResult && typeof parsedResult === "object" && !Array.isArray(parsedResult)
      ? parsedResult as Record<string, unknown>
      : null

  const textResult = typeof parsedResult === "string" ? parsedResult.trim() : ""
  const headingTitle = textResult.match(/^#\s+(.+)$/m)?.[1]?.trim()
  const recordTitle = resultRecord && typeof resultRecord.title === "string" ? resultRecord.title.trim() : ""
  const inputTitle = typeof inputRecord.title === "string" ? inputRecord.title.trim() : ""
  const textCandidate = textResult || ([
    resultRecord?.content,
    resultRecord?.text,
    resultRecord?.snippet,
    resultRecord?.summary,
    resultRecord?.description,
    resultRecord?.output,
  ].find((candidate) => typeof candidate === "string" && candidate.trim()) as string | undefined)?.trim()

  return [
    {
      title: inferSourceTitle(url, recordTitle || headingTitle || inputTitle),
      url,
      text: (textCandidate ?? recordTitle ?? headingTitle ?? inputTitle ?? url).trim().slice(0, 220),
    },
  ]
}

function resultHasError(result: unknown): boolean {
  const parsed = parseStructuredValue(result)
  if (!parsed || typeof parsed !== "object") return false

  const record = parsed as Record<string, unknown>
  if (record.success === false) return true
  return typeof record.error === "string" && record.error.trim().length > 0
}

export const SessionRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List sessions",
        description: "Get a list of all A2R sessions, sorted by most recently updated.",
        operationId: "session.list",
        responses: {
          200: {
            description: "List of sessions",
            content: {
              "application/json": {
                schema: resolver(Session.Info.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          directory: z.string().optional().meta({ description: "Filter sessions by project directory" }),
          roots: z.coerce.boolean().optional().meta({ description: "Only return root sessions (no parentID)" }),
          start: z.coerce
            .number()
            .optional()
            .meta({ description: "Filter sessions updated on or after this timestamp (milliseconds since epoch)" }),
          search: z.string().optional().meta({ description: "Filter sessions by title (case-insensitive)" }),
          limit: z.coerce.number().optional().meta({ description: "Maximum number of sessions to return" }),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const sessions: Session.Info[] = []
        for await (const session of Session.list({
          directory: query.directory,
          roots: query.roots,
          start: query.start,
          search: query.search,
          limit: query.limit,
        })) {
          sessions.push(session)
        }
        return c.json(sessions)
      },
    )
    .get(
      "/status",
      describeRoute({
        summary: "Get session status",
        description: "Retrieve the current status of all sessions, including active, idle, and completed states.",
        operationId: "session.status",
        responses: {
          200: {
            description: "Get session status",
            content: {
              "application/json": {
                schema: resolver(z.record(z.string(), SessionStatus.Info)),
              },
            },
          },
          ...errors(400),
        },
      }),
      async (c) => {
        const result = SessionStatus.list()
        return c.json(result)
      },
    )
    .get(
      "/:sessionID",
      describeRoute({
        summary: "Get session",
        description: "Retrieve detailed information about a specific A2R session.",
        tags: ["Session"],
        operationId: "session.get",
        responses: {
          200: {
            description: "Get session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.get.schema,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        log.info("SEARCH", { url: c.req.url })
        const session = await Session.get(sessionID)
        return c.json(session)
      },
    )
    .get(
      "/:sessionID/children",
      describeRoute({
        summary: "Get session children",
        tags: ["Session"],
        description: "Retrieve all child sessions that were forked from the specified parent session.",
        operationId: "session.children",
        responses: {
          200: {
            description: "List of children",
            content: {
              "application/json": {
                schema: resolver(Session.Info.array()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.children.schema,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const session = await Session.children(sessionID)
        return c.json(session)
      },
    )
    .get(
      "/:sessionID/todo",
      describeRoute({
        summary: "Get session todos",
        description: "Retrieve the todo list associated with a specific session, showing tasks and action items.",
        operationId: "session.todo",
        responses: {
          200: {
            description: "Todo list",
            content: {
              "application/json": {
                schema: resolver(Todo.Info.array()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const todos = await Todo.get(sessionID)
        return c.json(todos)
      },
    )
    .post(
      "/",
      describeRoute({
        summary: "Create session",
        description: "Create a new A2R session for interacting with AI assistants and managing conversations.",
        operationId: "session.create",
        responses: {
          ...errors(400),
          200: {
            description: "Successfully created session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
        },
      }),
      validator("json", Session.create.schema.optional()),
      async (c) => {
        const body = c.req.valid("json") ?? {}
        const session = await Session.create(body)
        return c.json(session)
      },
    )
    .delete(
      "/:sessionID",
      describeRoute({
        summary: "Delete session",
        description: "Delete a session and permanently remove all associated data, including messages and history.",
        operationId: "session.delete",
        responses: {
          200: {
            description: "Successfully deleted session",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.remove.schema,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        await Session.remove(sessionID)
        return c.json(true)
      },
    )
    .patch(
      "/:sessionID",
      describeRoute({
        summary: "Update session",
        description: "Update properties of an existing session, such as title or other metadata.",
        operationId: "session.update",
        responses: {
          200: {
            description: "Successfully updated session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string(),
        }),
      ),
      validator(
        "json",
        z.object({
          title: z.string().optional(),
          time: z
            .object({
              archived: z.number().optional(),
            })
            .optional(),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const updates = c.req.valid("json")

        let session = await Session.get(sessionID)
        if (updates.title !== undefined) {
          session = await Session.setTitle({ sessionID, title: updates.title })
        }
        if (updates.time?.archived !== undefined) {
          session = await Session.setArchived({ sessionID, time: updates.time.archived })
        }

        return c.json(session)
      },
    )
    .post(
      "/:sessionID/init",
      describeRoute({
        summary: "Initialize session",
        description:
          "Analyze the current application and create an AGENTS.md file with project-specific agent configurations.",
        operationId: "session.init",
        responses: {
          200: {
            description: "200",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator("json", Session.initialize.schema.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        await Session.initialize({ ...body, sessionID })
        return c.json(true)
      },
    )
    .post(
      "/:sessionID/fork",
      describeRoute({
        summary: "Fork session",
        description: "Create a new session by forking an existing session at a specific message point.",
        operationId: "session.fork",
        responses: {
          200: {
            description: "200",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.fork.schema.shape.sessionID,
        }),
      ),
      validator("json", Session.fork.schema.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        const result = await Session.fork({ ...body, sessionID })
        return c.json(result)
      },
    )
    .post(
      "/:sessionID/abort",
      describeRoute({
        summary: "Abort session",
        description: "Abort an active session and stop any ongoing AI processing or command execution.",
        operationId: "session.abort",
        responses: {
          200: {
            description: "Aborted session",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string(),
        }),
      ),
      async (c) => {
        SessionPrompt.cancel(c.req.valid("param").sessionID)
        return c.json(true)
      },
    )
    .post(
      "/:sessionID/share",
      describeRoute({
        summary: "Share session",
        description: "Create a shareable link for a session, allowing others to view the conversation.",
        operationId: "session.share",
        responses: {
          200: {
            description: "Successfully shared session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string(),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        await Session.share(sessionID)
        const session = await Session.get(sessionID)
        return c.json(session)
      },
    )
    .get(
      "/:sessionID/diff",
      describeRoute({
        summary: "Get message diff",
        description: "Get the file changes (diff) that resulted from a specific user message in the session.",
        operationId: "session.diff",
        responses: {
          200: {
            description: "Successfully retrieved diff",
            content: {
              "application/json": {
                schema: resolver(Snapshot.FileDiff.array()),
              },
            },
          },
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: SessionSummary.diff.schema.shape.sessionID,
        }),
      ),
      validator(
        "query",
        z.object({
          messageID: SessionSummary.diff.schema.shape.messageID,
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const params = c.req.valid("param")
        const result = await SessionSummary.diff({
          sessionID: params.sessionID,
          messageID: query.messageID,
        })
        return c.json(result)
      },
    )
    .delete(
      "/:sessionID/share",
      describeRoute({
        summary: "Unshare session",
        description: "Remove the shareable link for a session, making it private again.",
        operationId: "session.unshare",
        responses: {
          200: {
            description: "Successfully unshared session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: Session.unshare.schema,
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        await Session.unshare(sessionID)
        const session = await Session.get(sessionID)
        return c.json(session)
      },
    )
    .post(
      "/:sessionID/summarize",
      describeRoute({
        summary: "Summarize session",
        description: "Generate a concise summary of the session using AI compaction to preserve key information.",
        operationId: "session.summarize",
        responses: {
          200: {
            description: "Summarized session",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator(
        "json",
        z.object({
          providerID: z.string(),
          modelID: z.string(),
          auto: z.boolean().optional().default(false),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        const session = await Session.get(sessionID)
        await SessionRevert.cleanup(session)
        const msgs = await Session.messages({ sessionID })
        let currentAgent = await Agent.defaultAgent()
        for (let i = msgs.length - 1; i >= 0; i--) {
          const info = msgs[i].info
          if (info.role === "user") {
            currentAgent = info.agent || (await Agent.defaultAgent())
            break
          }
        }
        await SessionCompaction.create({
          sessionID,
          agent: currentAgent,
          model: {
            providerID: body.providerID,
            modelID: body.modelID,
          },
          auto: body.auto,
        })
        await SessionPrompt.loop({ sessionID })
        return c.json(true)
      },
    )
    .get(
      "/:sessionID/message",
      describeRoute({
        summary: "Get session messages",
        description: "Retrieve all messages in a session, including user prompts and AI responses.",
        operationId: "session.messages",
        responses: {
          200: {
            description: "List of messages",
            content: {
              "application/json": {
                schema: resolver(MessageV2.WithParts.array()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator(
        "query",
        z.object({
          limit: z.coerce.number().optional(),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const messages = await Session.messages({
          sessionID: c.req.valid("param").sessionID,
          limit: query.limit,
        })
        return c.json(messages)
      },
    )
    .get(
      "/:sessionID/message/:messageID",
      describeRoute({
        summary: "Get message",
        description: "Retrieve a specific message from a session by its message ID.",
        operationId: "session.message",
        responses: {
          200: {
            description: "Message",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    info: MessageV2.Info,
                    parts: MessageV2.Part.array(),
                  }),
                ),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
          messageID: z.string().meta({ description: "Message ID" }),
        }),
      ),
      async (c) => {
        const params = c.req.valid("param")
        const message = await MessageV2.get({
          sessionID: params.sessionID,
          messageID: params.messageID,
        })
        return c.json(message)
      },
    )
    .delete(
      "/:sessionID/message/:messageID/part/:partID",
      describeRoute({
        description: "Delete a part from a message",
        operationId: "part.delete",
        responses: {
          200: {
            description: "Successfully deleted part",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
          messageID: z.string().meta({ description: "Message ID" }),
          partID: z.string().meta({ description: "Part ID" }),
        }),
      ),
      async (c) => {
        const params = c.req.valid("param")
        await Session.removePart({
          sessionID: params.sessionID,
          messageID: params.messageID,
          partID: params.partID,
        })
        return c.json(true)
      },
    )
    .patch(
      "/:sessionID/message/:messageID/part/:partID",
      describeRoute({
        description: "Update a part in a message",
        operationId: "part.update",
        responses: {
          200: {
            description: "Successfully updated part",
            content: {
              "application/json": {
                schema: resolver(MessageV2.Part),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
          messageID: z.string().meta({ description: "Message ID" }),
          partID: z.string().meta({ description: "Part ID" }),
        }),
      ),
      validator("json", MessageV2.Part),
      async (c) => {
        const params = c.req.valid("param")
        const body = c.req.valid("json")
        if (body.id !== params.partID || body.messageID !== params.messageID || body.sessionID !== params.sessionID) {
          throw new Error(
            `Part mismatch: body.id='${body.id}' vs partID='${params.partID}', body.messageID='${body.messageID}' vs messageID='${params.messageID}', body.sessionID='${body.sessionID}' vs sessionID='${params.sessionID}'`,
          )
        }
        const part = await Session.updatePart(body)
        return c.json(part)
      },
    )
    .post(
      "/:sessionID/message",
      describeRoute({
        summary: "Send message",
        description: "Create and send a new message to a session, streaming the AI response.",
        operationId: "session.prompt",
        responses: {
          200: {
            description: "Created message",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    info: MessageV2.Assistant,
                    parts: MessageV2.Part.array(),
                  }),
                ),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator("json", SessionPrompt.PromptInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")

        c.status(200)
        c.header("Content-Type", "application/x-ndjson; charset=utf-8")
        c.header("Cache-Control", "no-cache, no-transform")
        c.header("X-Accel-Buffering", "no") // Disable nginx buffering
        c.header("Connection", "keep-alive")
        c.header("Transfer-Encoding", "chunked") // Force chunked transfer for immediate delivery

        return stream(c, async (stream) => {
          let assistantMessageID: string | null = null
          const partTypes = new Map<string, "text" | "reasoning" | "tool">()
          const planID = `plan-${sessionID}`
          const planSteps: StreamPlanStep[] = []
          const toolLabelsByCallID = new Map<string, string>()
          const toolDescriptionsByCallID = new Map<string, string>()
          const sourceIDsByUrl = new Map<string, string>()
          const reasoningTextByPartID = new Map<string, string>()
          const completedToolCallIDs = new Set<string>()
          const erroredToolCallIDs = new Set<string>()
          const emittedArtifactIDs = new Set<string>()
          let planStarted = false
          let checkpointCount = 0

          // Serialized write queue to prevent interleaving
          let writeChain = Promise.resolve()
          const enqueueWrite = (line: string) => {
            writeChain = writeChain.then(async () => {
              await stream.write(line)
              if ((stream as any).flush) await (stream as any).flush()
            }).catch((err: any) => {
              console.error("[stream] write failed", err)
            })
          }

          const writeEvent = (event: any) => {
            // Ensure messageId is always present if we have it
            if (!event.messageId && assistantMessageID) {
              event.messageId = assistantMessageID
            }
            const data = JSON.stringify(event) + "\n"
            enqueueWrite(data)
          }

          const emitPlan = (eventType: "plan" | "plan_update") => {
            writeEvent({
              type: eventType,
              planId: planID,
              title: "Live execution plan",
              steps: planSteps.map((step) => ({ ...step })),
            })
          }

          const upsertPlanStep = (id: string, description: string, status: PlanStepStatus) => {
            const existingIndex = planSteps.findIndex((step) => step.id === id)
            const nextStep: StreamPlanStep = { id, description, status }

            if (existingIndex >= 0) {
              planSteps[existingIndex] = nextStep
            } else {
              planSteps.push(nextStep)
            }
          }

          const ensureToolUseStarted = (part: MessageV2.ToolPart, toolInput: unknown) => {
            if (partTypes.has(part.id)) return

            partTypes.set(part.id, "tool")
            writeEvent({
              type: "content_block_start",
              content_block: {
                type: "tool_use",
                id: part.callID,
                name: part.tool,
                input: toolInput,
              },
            })
          }

          const emitImageArtifacts = (callID: string, toolLabel: string, attachments?: MessageV2.FilePart[]) => {
            for (const [index, attachment] of (attachments ?? []).entries()) {
              if (!attachment.mime.startsWith("image/")) continue

              const artifactID = `artifact-${callID}-${index + 1}`
              if (emittedArtifactIDs.has(artifactID)) continue
              emittedArtifactIDs.add(artifactID)

              writeEvent({
                type: "artifact",
                artifactId: artifactID,
                kind: "image",
                title: attachment.filename ?? `${toolLabel} image`,
                url: attachment.url,
                content: attachment.url.startsWith("data:") ? attachment.url : undefined,
              })
            }
          }

          const unsub = Bus.subscribeAll((event) => {
            try {
              // Filter events for this session
              const isMatch =
                event.properties.sessionID === sessionID ||
                event.properties.part?.sessionID === sessionID ||
                event.properties.info?.sessionID === sessionID

              if (!isMatch) return

              // Map internal Bus events to UI-friendly stream events
              let streamEvent: any = null

              switch (event.type) {
                case MessageV2.Event.Updated.type:
                  const info = event.properties.info as MessageV2.Info
                  if (info.role === "assistant" && !assistantMessageID) {
                    assistantMessageID = info.id
                    streamEvent = {
                      type: "message_start",
                      messageId: info.id,
                    }
                  }
                  break

                case MessageV2.Event.PartUpdated.type:
                  const part = event.properties.part as MessageV2.Part
                  // Only send content_block_start for NEW parts (not updates to existing parts)
                  // This prevents re-sending full text at reasoning-end/tool-end
                  if (part.type === "text" && !partTypes.has(part.id)) {
                    partTypes.set(part.id, "text")
                    streamEvent = {
                      type: "content_block_start",
                      content_block: {
                        id: part.id,
                        type: "text",
                        text: part.text,
                      },
                    }
                  } else if (part.type === "reasoning" && !partTypes.has(part.id)) {
                    partTypes.set(part.id, "reasoning")
                    reasoningTextByPartID.set(part.id, part.text)
                    streamEvent = {
                      type: "content_block_start",
                      content_block: {
                        id: part.id,
                        type: "thinking",
                        thinking: part.text,
                      },
                      metadata: {
                        reasoningTrace: buildReasoningTrace(part.text),
                      },
                    }
                  } else if (part.type === "tool") {
                    const toolInput = parseStructuredValue(part.state.input)
                    const toolLabel = toolLabelsByCallID.get(part.callID) ?? humanizeToolLabel(part.tool)
                    const toolDescription = toolDescriptionsByCallID.get(part.callID) ?? summarizeToolInput(toolInput)
                    const stepDescription = toolDescription ? `${toolLabel}: ${toolDescription}` : toolLabel

                    toolLabelsByCallID.set(part.callID, toolLabel)
                    if (toolDescription) {
                      toolDescriptionsByCallID.set(part.callID, toolDescription)
                    }

                    if (part.state.status === "running") {
                      if (!partTypes.has(part.id)) {
                        ensureToolUseStarted(part, toolInput)
                        upsertPlanStep(part.callID, stepDescription, "in-progress")
                        emitPlan(planStarted ? "plan_update" : "plan")
                        planStarted = true

                        writeEvent({
                          type: "task",
                          taskId: part.callID,
                          title: toolLabel,
                          description: toolDescription,
                          status: "running",
                          progress: 35,
                        })
                      }
                    } else if (part.state.status === "completed") {
                      ensureToolUseStarted(part, toolInput)
                      if (!completedToolCallIDs.has(part.callID)) {
                        completedToolCallIDs.add(part.callID)

                        const parsedResult = parseStructuredValue(part.state.output)
                        const failed = resultHasError(parsedResult)
                        const sources = extractToolSources(toolInput, parsedResult)

                        writeEvent({
                          type: "tool_result",
                          toolCallId: part.callID,
                          result: parsedResult,
                        })

                        upsertPlanStep(part.callID, stepDescription, failed ? "error" : "complete")
                        emitPlan(planStarted ? "plan_update" : "plan")
                        planStarted = true

                        writeEvent({
                          type: "task",
                          taskId: part.callID,
                          title: toolLabel,
                          description: toolDescription,
                          status: failed ? "error" : "complete",
                          progress: 100,
                        })

                        for (const [index, source] of sources.entries()) {
                          let sourceID = sourceIDsByUrl.get(source.url)
                          if (!sourceID) {
                            sourceID = `src-${part.callID}-${index + 1}`
                            sourceIDsByUrl.set(source.url, sourceID)
                            writeEvent({
                              type: "source",
                              sourceId: sourceID,
                              title: source.title,
                              url: source.url,
                            })
                          }

                          writeEvent({
                            type: "citation",
                            citationId: `citation-${part.callID}-${index + 1}`,
                            sourceId: sourceID,
                            text: source.text,
                            startIndex: 0,
                            endIndex: source.text.length,
                          })
                        }

                        emitImageArtifacts(part.callID, toolLabel, part.state.attachments)

                        checkpointCount += 1
                        writeEvent({
                          type: "checkpoint",
                          checkpointId: `checkpoint-${checkpointCount}`,
                          description: failed
                            ? `${toolLabel} reported an error`
                            : sources.length > 0
                              ? `${toolLabel} returned ${sources.length} source${sources.length === 1 ? "" : "s"}`
                              : `${toolLabel} completed`,
                        })
                      }
                    } else if (part.state.status === "error") {
                      ensureToolUseStarted(part, toolInput)
                      if (!erroredToolCallIDs.has(part.callID)) {
                        erroredToolCallIDs.add(part.callID)

                        upsertPlanStep(part.callID, stepDescription, "error")
                        emitPlan(planStarted ? "plan_update" : "plan")
                        planStarted = true

                        writeEvent({
                          type: "tool_error",
                          toolCallId: part.callID,
                          error: part.state.error,
                        })

                        writeEvent({
                          type: "task",
                          taskId: part.callID,
                          title: toolLabel,
                          description: toolDescription,
                          status: "error",
                          progress: 100,
                        })

                        checkpointCount += 1
                        writeEvent({
                          type: "checkpoint",
                          checkpointId: `checkpoint-${checkpointCount}`,
                          description: `${toolLabel} reported an error`,
                        })
                      }
                    }
                  }
                  break

                case MessageV2.Event.PartDelta.type:
                  const delta = event.properties
                  if (delta.field === "text") {
                    const type = partTypes.get(delta.partID) || "text"
                    if (type === "reasoning") {
                      const nextReasoningText = `${reasoningTextByPartID.get(delta.partID) ?? ""}${delta.delta}`
                      reasoningTextByPartID.set(delta.partID, nextReasoningText)
                    }
                    streamEvent = {
                      type: "content_block_delta",
                      partId: delta.partID,
                      delta: type === "reasoning"
                        ? {
                            type: "thinking_delta",
                            thinking: delta.delta,
                          }
                        : {
                            type: "text_delta",
                            text: delta.delta,
                          },
                      metadata: type === "reasoning"
                        ? {
                            reasoningTrace: buildReasoningTrace(reasoningTextByPartID.get(delta.partID) ?? delta.delta),
                          }
                        : undefined,
                    }
                  }
                  break
              }

              if (streamEvent) {
                writeEvent(streamEvent)
              }
            } catch (err) {
              console.error(`[stream] event handler error:`, err)
              writeEvent({ type: "error", error: err instanceof Error ? err.message : String(err) })
            }
          })

          try {
            // Write a valid JSON ping immediately to force headers and connection open
            writeEvent({ type: "ping", t: Date.now() })

            const msg = await SessionPrompt.prompt({ ...body, sessionID })
            const assistantInfo = msg.info.role === "assistant" ? msg.info : null

            // Wait a bit for any final Bus events to flush before sending finish
            await new Promise(resolve => setTimeout(resolve, 50))

            // Final sync - metadata only to avoid overwriting streamed deltas
            writeEvent({
              type: "finish",
              messageId: msg.info.id,
              status: assistantInfo?.error ? "error" : "complete",
              modelId: assistantInfo?.modelID,
              runtimeModelId: assistantInfo ? `${assistantInfo.providerID}/${assistantInfo.modelID}` : undefined,
              finishedAt: assistantInfo?.time.completed ?? Date.now(),
              durationMs: assistantInfo?.time.completed
                ? Math.max(0, assistantInfo.time.completed - assistantInfo.time.created)
                : undefined,
            })

            // Give final events time to flush before closing
            await new Promise(resolve => setTimeout(resolve, 100))
          } catch (e) {
            log.error("stream error", {
              error: e instanceof Error ? e.message : String(e),
            })
            writeEvent({ type: "error", error: String(e) })
          } finally {
            unsub()
          }
        })
      },
    )
    .post(
      "/:sessionID/prompt_async",
      describeRoute({
        summary: "Send async message",
        description:
          "Create and send a new message to a session asynchronously, starting the session if needed and returning immediately with a runId.",
        operationId: "session.prompt_async",
        responses: {
          200: {
            description: "Prompt accepted, run started",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    runId: z.string(),
                    status: RunRegistry.RunStatus,
                  }),
                ),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator("json", SessionPrompt.PromptInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")

        // Create run entry
        const { runId } = RunRegistry.create(sessionID, body.agent, body.parts?.find((p) => p.type === "text")?.text)

        // Start the prompt asynchronously
        const promptPromise = SessionPrompt.prompt({ ...body, sessionID })
          .then(() => {
            RunRegistry.complete(runId, "completed")
          })
          .catch((error) => {
            RunRegistry.complete(runId, "errored", error instanceof Error ? error.message : String(error))
          })

        // Register the promise with run registry
        RunRegistry.start(runId, promptPromise)

        return c.json({
          runId,
          status: "running" as const,
        })
      },
    )
    .get(
      "/:sessionID/runs",
      describeRoute({
        summary: "List session runs",
        description: "Get all runs for a session",
        operationId: "session.runs.list",
        responses: {
          200: {
            description: "List of runs",
            content: {
              "application/json": {
                schema: resolver(RunRegistry.RunInfo.array()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const runs = RunRegistry.list(sessionID)
        return c.json(runs)
      },
    )
    .get(
      "/:sessionID/runs/:runId",
      describeRoute({
        summary: "Get run",
        description: "Get details of a specific run",
        operationId: "session.runs.get",
        responses: {
          200: {
            description: "Run details",
            content: {
              "application/json": {
                schema: resolver(RunRegistry.RunInfo),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
          runId: z.string().meta({ description: "Run ID" }),
        }),
      ),
      async (c) => {
        const { runId } = c.req.valid("param")
        const run = RunRegistry.get(runId)
        if (!run) {
          return c.json({ error: `Run "${runId}" not found` }, 404)
        }
        return c.json(run)
      },
    )
    .post(
      "/:sessionID/runs/:runId/abort",
      describeRoute({
        summary: "Abort run",
        description: "Abort a specific run by ID",
        operationId: "session.runs.abort",
        responses: {
          200: {
            description: "Run aborted",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    success: z.boolean(),
                    runId: z.string(),
                  }),
                ),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
          runId: z.string().meta({ description: "Run ID" }),
        }),
      ),
      async (c) => {
        const { runId } = c.req.valid("param")
        const success = RunRegistry.abort(runId)
        return c.json({ success, runId })
      },
    )
    .get(
      "/:sessionID/runs/:runId/wait",
      describeRoute({
        summary: "Wait for run",
        description: "Wait for a run to complete and return final status",
        operationId: "session.runs.wait",
        responses: {
          200: {
            description: "Run completed",
            content: {
              "application/json": {
                schema: resolver(RunRegistry.RunInfo),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
          runId: z.string().meta({ description: "Run ID" }),
        }),
      ),
      async (c) => {
        const { runId } = c.req.valid("param")
        const run = await RunRegistry.wait(runId)
        return c.json(run)
      },
    )
    .post(
      "/:sessionID/command",
      describeRoute({
        summary: "Send command",
        description: "Send a new command to a session for execution by the AI assistant.",
        operationId: "session.command",
        responses: {
          200: {
            description: "Created message",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    info: MessageV2.Assistant,
                    parts: MessageV2.Part.array(),
                  }),
                ),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator("json", SessionPrompt.CommandInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        const msg = await SessionPrompt.command({ ...body, sessionID })
        return c.json(msg)
      },
    )
    .post(
      "/:sessionID/shell",
      describeRoute({
        summary: "Run shell command",
        description: "Execute a shell command within the session context and return the AI's response.",
        operationId: "session.shell",
        responses: {
          200: {
            description: "Created message",
            content: {
              "application/json": {
                schema: resolver(MessageV2.Assistant),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().meta({ description: "Session ID" }),
        }),
      ),
      validator("json", SessionPrompt.ShellInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const body = c.req.valid("json")
        const msg = await SessionPrompt.shell({ ...body, sessionID })
        return c.json(msg)
      },
    )
    .post(
      "/:sessionID/revert",
      describeRoute({
        summary: "Revert message",
        description: "Revert a specific message in a session, undoing its effects and restoring the previous state.",
        operationId: "session.revert",
        responses: {
          200: {
            description: "Updated session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string(),
        }),
      ),
      validator("json", SessionRevert.RevertInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        log.info("revert", c.req.valid("json"))
        const session = await SessionRevert.revert({
          sessionID,
          ...c.req.valid("json"),
        })
        return c.json(session)
      },
    )
    .post(
      "/:sessionID/unrevert",
      describeRoute({
        summary: "Restore reverted messages",
        description: "Restore all previously reverted messages in a session.",
        operationId: "session.unrevert",
        responses: {
          200: {
            description: "Updated session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string(),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const session = await SessionRevert.unrevert({ sessionID })
        return c.json(session)
      },
    )
    .post(
      "/:sessionID/permissions/:permissionID",
      describeRoute({
        summary: "Respond to permission",
        deprecated: true,
        description: "Approve or deny a permission request from the AI assistant.",
        operationId: "permission.respond",
        responses: {
          200: {
            description: "Permission processed successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string(),
          permissionID: z.string(),
        }),
      ),
      validator("json", z.object({ response: PermissionNext.Reply })),
      async (c) => {
        const params = c.req.valid("param")
        PermissionNext.reply({
          requestID: params.permissionID,
          reply: c.req.valid("json").response,
        })
        return c.json(true)
      },
    ),
)
