import { MessageV2 } from "./message-v2"
import { Log } from "@/util/log"
import { Identifier } from "@/id/id"
import { Session } from "."
import { Agent } from "@/agent/agent"
import { Snapshot } from "@/snapshot"
import { SessionSummary } from "./summary"
import { Bus } from "@/bus"
import { SessionRetry } from "./retry"
import { SessionStatus } from "./status"
import { Plugin } from "@/plugin"
import type { Provider } from "@/provider/provider"
import { LLM } from "./llm"
import { Config } from "@/config/config"
import { SessionCompaction } from "./compaction"
import { PermissionNext } from "@/permission/next"
import { Question } from "@/question"
import { SessionUsage } from "./usage"

export namespace SessionProcessor {
  const DOOM_LOOP_THRESHOLD = 3
  const DEFAULT_RETRY_MAX_ATTEMPTS = 2
  const DEFAULT_RETRY_MAX_DELAY_MS = 10_000
  const log = Log.create({ service: "session.processor" })

  export type Info = Awaited<ReturnType<typeof create>>
  export type Result = Awaited<ReturnType<Info["process"]>>

  export function create(input: {
    assistantMessage: MessageV2.Assistant
    sessionID: string
    model: Provider.Model
    abort: AbortSignal
  }) {
    const toolcalls: Record<string, MessageV2.ToolPart> = {}
    let snapshot: string | undefined
    let blocked = false
    let attempt = 0
    let needsCompaction = false

    const result = {
      get message() {
        return input.assistantMessage
      },
      partFromToolCall(toolCallID: string) {
        return toolcalls[toolCallID]
      },
      async process(streamInput: LLM.StreamInput) {
        log.info("process")
        needsCompaction = false
        const cfg = await Config.get()
        const shouldBreak = cfg.experimental?.continue_loop_on_deny !== true
        const retryMaxAttempts = cfg.experimental?.retry_max_attempts ?? DEFAULT_RETRY_MAX_ATTEMPTS
        const retryMaxDelayMs = cfg.experimental?.retry_max_delay_ms ?? DEFAULT_RETRY_MAX_DELAY_MS
        while (true) {
          try {
            let currentText: MessageV2.TextPart | undefined
            let currentReasoning: MessageV2.ReasoningPart | undefined
            let reasoningMap: Record<string, MessageV2.ReasoningPart> = {}
            const stream = await LLM.stream(streamInput)

            // State machine for splitting <think> tags
            let mode: "text" | "thinking" = "text"
            let tagBuffer = ""

            for await (const value of stream.fullStream) {
              input.abort.throwIfAborted()
              switch (value.type) {
                case "start":
                  SessionStatus.set(input.sessionID, { type: "busy" })
                  break

                case "reasoning-start":
                  if (value.id in reasoningMap) {
                    continue
                  }
                  const reasoningPart = {
                    id: Identifier.ascending("part"),
                    messageID: input.assistantMessage.id,
                    sessionID: input.assistantMessage.sessionID,
                    type: "reasoning" as const,
                    text: "",
                    time: {
                      start: Date.now(),
                    },
                    metadata: value.providerMetadata,
                  }
                  reasoningMap[value.id] = reasoningPart
                  await Session.updatePart(reasoningPart)

                  // FORCE IMMEDIATE BUS PUBLISH
                  Bus.publish(MessageV2.Event.PartUpdated, {
                    messageID: reasoningPart.messageID,
                    sessionID: reasoningPart.sessionID,
                    part: reasoningPart,
                  })
                  break

                case "reasoning-delta":
                  if (value.id in reasoningMap) {
                    const part = reasoningMap[value.id]
                    part.text += value.text
                    if (value.providerMetadata) part.metadata = value.providerMetadata
                    await Session.updatePartDelta({
                      sessionID: part.sessionID,
                      messageID: part.messageID,
                      partID: part.id,
                      field: "text",
                      delta: value.text,
                    })
                  }
                  break

                case "reasoning-end":
                  if (value.id in reasoningMap) {
                    const part = reasoningMap[value.id]
                    part.text = part.text.trimEnd()

                    part.time = {
                      ...part.time,
                      end: Date.now(),
                    }
                    if (value.providerMetadata) part.metadata = value.providerMetadata
                    await Session.updatePart(part)
                    
                    Bus.publish(MessageV2.Event.PartUpdated, {
                      messageID: part.messageID,
                      sessionID: part.sessionID,
                      part,
                    })
                    
                    delete reasoningMap[value.id]
                  }
                  break

                case "tool-input-start":
                  const part = (await Session.updatePart({
                    id: toolcalls[value.id]?.id ?? Identifier.ascending("part"),
                    messageID: input.assistantMessage.id,
                    sessionID: input.assistantMessage.sessionID,
                    type: "tool",
                    tool: value.toolName,
                    callID: value.id,
                    state: {
                      status: "pending",
                      input: {},
                      raw: "",
                    },
                  })) as MessageV2.ToolPart
                  toolcalls[value.id] = part
                  
                  Bus.publish(MessageV2.Event.PartUpdated, {
                    messageID: part.messageID,
                    sessionID: part.sessionID,
                    part,
                  })
                  break

                case "tool-input-delta":
                  break

                case "tool-input-end":
                  break

                case "tool-call": {
                  const match = toolcalls[value.toolCallId]
                  if (match) {
                    const part = (await Session.updatePart({
                      ...match,
                      tool: value.toolName,
                      state: {
                        status: "running",
                        input: value.input,
                        time: {
                          start: Date.now(),
                        },
                      },
                      metadata: value.providerMetadata,
                    })) as MessageV2.ToolPart
                    toolcalls[value.toolCallId] = part

                    Bus.publish(MessageV2.Event.PartUpdated, {
                      messageID: part.messageID,
                      sessionID: part.sessionID,
                      part,
                    })

                    const parts = await MessageV2.parts(input.assistantMessage.id)
                    const lastThree = parts.slice(-DOOM_LOOP_THRESHOLD)

                    if (
                      lastThree.length === DOOM_LOOP_THRESHOLD &&
                      lastThree.every(
                        (p) =>
                          p.type === "tool" &&
                          p.tool === value.toolName &&
                          p.state.status !== "pending" &&
                          JSON.stringify(p.state.input) === JSON.stringify(value.input),
                      )
                    ) {
                      const agent = await Agent.get(input.assistantMessage.agent)
                      await PermissionNext.ask({
                        permission: "doom_loop",
                        patterns: [value.toolName],
                        sessionID: input.assistantMessage.sessionID,
                        metadata: {
                          tool: value.toolName,
                          input: value.input,
                        },
                        always: [value.toolName],
                        ruleset: agent.permission,
                      })
                    }
                  }
                  break
                }
                case "tool-result": {
                  const match = toolcalls[value.toolCallId]
                  if (match && match.state.status === "running") {
                    const part = (await Session.updatePart({
                      ...match,
                      state: {
                        status: "completed",
                        input: value.input ?? match.state.input,
                        output: value.output.output,
                        metadata: value.output.metadata,
                        title: value.output.title,
                        time: {
                          start: match.state.time.start,
                          end: Date.now(),
                        },
                        attachments: value.output.attachments,
                      },
                    })) as MessageV2.ToolPart

                    Bus.publish(MessageV2.Event.PartUpdated, {
                      messageID: part.messageID,
                      sessionID: part.sessionID,
                      part,
                    })

                    delete toolcalls[value.toolCallId]
                  }
                  break
                }

                case "tool-error": {
                  const match = toolcalls[value.toolCallId]
                  if (match && match.state.status === "running") {
                    const part = (await Session.updatePart({
                      ...match,
                      state: {
                        status: "error",
                        input: value.input ?? match.state.input,
                        error: (value.error as any).toString(),
                        time: {
                          start: match.state.time.start,
                          end: Date.now(),
                        },
                      },
                    })) as MessageV2.ToolPart

                    Bus.publish(MessageV2.Event.PartUpdated, {
                      messageID: part.messageID,
                      sessionID: part.sessionID,
                      part,
                    })

                    if (
                      value.error instanceof PermissionNext.RejectedError ||
                      value.error instanceof Question.RejectedError
                    ) {
                      blocked = shouldBreak
                    }
                    delete toolcalls[value.toolCallId]
                  }
                  break
                }
                case "error":
                  throw value.error

                case "start-step":
                  snapshot = await Snapshot.track()
                  await Session.updatePart({
                    id: Identifier.ascending("part"),
                    messageID: input.assistantMessage.id,
                    sessionID: input.sessionID,
                    snapshot,
                    type: "step-start",
                  })
                  break

                case "finish-step":
                  const usage = Session.getUsage({
                    model: input.model,
                    usage: value.usage,
                    metadata: value.providerMetadata,
                  })
                  input.assistantMessage.finish = value.finishReason
                  input.assistantMessage.cost += usage.cost
                  input.assistantMessage.tokens = usage.tokens
                  await Session.updatePart({
                    id: Identifier.ascending("part"),
                    reason: value.finishReason ?? "unknown",
                    snapshot: await Snapshot.track(),
                    messageID: input.assistantMessage.id,
                    sessionID: input.assistantMessage.sessionID,
                    type: "step-finish",
                    tokens: usage.tokens,
                    cost: usage.cost,
                  })
                  await Session.updateMessage(input.assistantMessage)
                  // Record usage for analytics
                  await SessionUsage.record({
                    sessionID: input.sessionID,
                    messageID: input.assistantMessage.id,
                    providerID: input.model.providerID,
                    modelID: input.model.id,
                    tokens: usage.tokens,
                    cost: usage.cost,
                  })
                  if (snapshot) {
                    const patch = await Snapshot.patch(snapshot)
                    if (patch.files.length) {
                      await Session.updatePart({
                        id: Identifier.ascending("part"),
                        messageID: input.assistantMessage.id,
                        sessionID: input.sessionID,
                        type: "patch",
                        hash: patch.hash,
                        files: patch.files,
                      })
                    }
                    snapshot = undefined
                  }
                  SessionSummary.summarize({
                    sessionID: input.sessionID,
                    messageID: input.assistantMessage.parentID,
                  })
                  if (await SessionCompaction.isOverflow({ tokens: usage.tokens, model: input.model })) {
                    needsCompaction = true
                  }
                  break

                case "text-start":
                  // Reset state machine for new block
                  mode = "text"
                  tagBuffer = ""
                  break

                case "text-delta": {
                  const text = value.text
                  tagBuffer += text

                  while (tagBuffer.length > 0) {
                    if (mode === "text") {
                      const openIndex = tagBuffer.indexOf("<think>")
                      if (openIndex === -1) {
                        // No full tag, but watch out for partial tag at the end
                        const potentialPrefix = "<think>"
                        let matchLen = 0
                        for (let len = potentialPrefix.length - 1; len > 0; len--) {
                          if (tagBuffer.endsWith(potentialPrefix.slice(0, len))) {
                            matchLen = len
                            break
                          }
                        }

                        // Emit all text except the potential partial tag at the end
                        const safeText = tagBuffer.slice(0, tagBuffer.length - matchLen)
                        if (safeText) {
                          if (!currentText) {
                            currentText = (await Session.updatePart({
                              id: Identifier.ascending("part"),
                              messageID: input.assistantMessage.id,
                              sessionID: input.assistantMessage.sessionID,
                              type: "text",
                              text: "",
                              time: { start: Date.now() },
                            })) as MessageV2.TextPart
                          }
                          currentText.text += safeText
                          await Session.updatePartDelta({
                            sessionID: currentText.sessionID,
                            messageID: currentText.messageID,
                            partID: currentText.id,
                            field: "text",
                            delta: safeText,
                          })

                          tagBuffer = tagBuffer.slice(safeText.length)
                        }
                        break // Wait for more data to complete potential tag
                      } else {
                        // Tag found
                        const before = tagBuffer.slice(0, openIndex)
                        if (before) {
                          if (!currentText) {
                            currentText = (await Session.updatePart({
                              id: Identifier.ascending("part"),
                              messageID: input.assistantMessage.id,
                              sessionID: input.assistantMessage.sessionID,
                              type: "text",
                              text: "",
                              time: { start: Date.now() },
                            })) as MessageV2.TextPart
                          }
                          currentText.text += before
                          await Session.updatePartDelta({
                            sessionID: currentText.sessionID,
                            messageID: currentText.messageID,
                            partID: currentText.id,
                            field: "text",
                            delta: before,
                          })
                        }
                        
                        // Transition to thinking
                        if (currentText) {
                          await Session.updatePart({ ...currentText, time: { ...currentText.time, end: Date.now() } })
                          currentText = undefined
                        }
                        mode = "thinking"
                        currentReasoning = (await Session.updatePart({
                          id: Identifier.ascending("part"),
                          messageID: input.assistantMessage.id,
                          sessionID: input.assistantMessage.sessionID,
                          type: "reasoning",
                          text: "",
                          time: { start: Date.now() },
                        })) as MessageV2.ReasoningPart
                        
                        // Emit PartUpdated for the new reasoning part
                        Bus.publish(MessageV2.Event.PartUpdated, {
                          messageID: currentReasoning.messageID,
                          sessionID: currentReasoning.sessionID,
                          part: currentReasoning,
                        })

                        tagBuffer = tagBuffer.slice(openIndex + "<think>".length)
                      }
                    } else {
                      // mode === "thinking"
                      const closeIndex = tagBuffer.indexOf("</think>")
                      if (closeIndex === -1) {
                        // ...
                      } else {
                        // Tag found
                        const before = tagBuffer.slice(0, closeIndex)
                        if (before) {
                          if (!currentReasoning) {
                            currentReasoning = (await Session.updatePart({
                              id: Identifier.ascending("part"),
                              messageID: input.assistantMessage.id,
                              sessionID: input.assistantMessage.sessionID,
                              type: "reasoning",
                              text: "",
                              time: { start: Date.now() },
                            })) as MessageV2.ReasoningPart
                          }
                          currentReasoning.text += before
                          await Session.updatePartDelta({
                            sessionID: currentReasoning.sessionID,
                            messageID: currentReasoning.messageID,
                            partID: currentReasoning.id,
                            field: "text",
                            delta: before,
                          })
                        }
                        
                        // Transition
                        if (currentReasoning) {
                          await Session.updatePart({ ...currentReasoning, time: { ...currentReasoning.time, end: Date.now() } })
                          currentReasoning = undefined
                        }
                        mode = "text"

                        // Start a new text part immediately after thinking
                        const newTextPart = (await Session.updatePart({
                          id: Identifier.ascending("part"),
                          messageID: input.assistantMessage.id,
                          sessionID: input.assistantMessage.sessionID,
                          type: "text",
                          text: "",
                          time: { start: Date.now() },
                        })) as MessageV2.TextPart
                        currentText = newTextPart
                        
                        Bus.publish(MessageV2.Event.PartUpdated, {
                          messageID: currentText.messageID,
                          sessionID: currentText.sessionID,
                          part: currentText,
                        })

                        tagBuffer = tagBuffer.slice(closeIndex + "</think>".length)
                      }
                    }
                  }
                  break
                }

                case "text-end":
                  if (currentText) {
                    currentText.text = currentText.text.trimEnd()
                    const textOutput = await Plugin.trigger(
                      "experimental.text.complete",
                      {
                        sessionID: input.sessionID,
                        messageID: input.assistantMessage.id,
                        partID: currentText.id,
                      },
                      { text: currentText.text },
                    )
                    currentText.text = textOutput.text
                    currentText.time = {
                      start: Date.now(),
                      end: Date.now(),
                    }
                    if (value.providerMetadata) currentText.metadata = value.providerMetadata
                    await Session.updatePart(currentText)
                  }
                  if (currentReasoning) {
                    await Session.updatePart({ ...currentReasoning, time: { ...currentReasoning.time, end: Date.now() } })
                  }
                  currentText = undefined
                  currentReasoning = undefined
                  break

                case "finish":
                  break

                default:
                  log.info("unhandled", {
                    ...value,
                  })
                  continue
              }
              if (needsCompaction) break
            }
          } catch (e: any) {
            log.error("process", {
              error: e,
              stack: JSON.stringify(e.stack),
            })
            const error = MessageV2.fromError(e, { providerID: input.model.providerID })
            if (MessageV2.ContextOverflowError.isInstance(error)) {
              // TODO: Handle context overflow error
            }
            const retry = SessionRetry.retryable(error)
            if (retry !== undefined) {
              if (attempt >= retryMaxAttempts) {
                log.warn("retry limit reached", {
                  attempt,
                  retryMaxAttempts,
                  retry,
                })
                input.assistantMessage.error =
                  MessageV2.APIError.isInstance(error)
                    ? new MessageV2.APIError({
                        ...error.data,
                        isRetryable: false,
                        message: `${retry} (retry limit reached after ${attempt} attempt${
                          attempt === 1 ? "" : "s"
                        })`,
                      }).toObject()
                    : error
                Bus.publish(Session.Event.Error, {
                  sessionID: input.assistantMessage.sessionID,
                  error: input.assistantMessage.error,
                })
                SessionStatus.set(input.sessionID, { type: "idle" })
              } else {
                attempt++
                const delay = Math.min(
                  SessionRetry.delay(attempt, error.name === "APIError" ? error : undefined),
                  retryMaxDelayMs,
                )
                SessionStatus.set(input.sessionID, {
                  type: "retry",
                  attempt,
                  message: retry as string,
                  next: Date.now() + delay,
                })
                await SessionRetry.sleep(delay, input.abort).catch(() => {})
                continue
              }
            }
            if (!input.assistantMessage.error) {
              input.assistantMessage.error = error
            }
            Bus.publish(Session.Event.Error, {
              sessionID: input.assistantMessage.sessionID,
              error: input.assistantMessage.error,
            })
            SessionStatus.set(input.sessionID, { type: "idle" })
          }
          if (snapshot) {
            const patch = await Snapshot.patch(snapshot)
            if (patch.files.length) {
              await Session.updatePart({
                id: Identifier.ascending("part"),
                messageID: input.assistantMessage.id,
                sessionID: input.sessionID,
                type: "patch",
                hash: patch.hash,
                files: patch.files,
              })
            }
            snapshot = undefined
          }
          const p = await MessageV2.parts(input.assistantMessage.id)
          for (const part of p) {
            if (part.type === "tool" && part.state.status !== "completed" && part.state.status !== "error") {
              await Session.updatePart({
                ...part,
                state: {
                  ...part.state,
                  status: "error",
                  error: "Tool execution aborted",
                  time: {
                    start: Date.now(),
                    end: Date.now(),
                  },
                },
              })
            }
          }
          input.assistantMessage.time.completed = Date.now()
          await Session.updateMessage(input.assistantMessage)
          if (needsCompaction) return "compact"
          if (blocked) return "stop"
          if (input.assistantMessage.error) return "stop"
          return "continue"
        }
      },
    }
    return result
  }
}
