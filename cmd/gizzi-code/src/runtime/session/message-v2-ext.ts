/**
 * MessageV2 Extension - Adds Claude content types to Gizzi session
 * 
 * This file extends the existing MessageV2 namespace with additional
 * Part types from Claude's content system.
 */

import z from "zod/v4"
import { MessageV2 } from "./message-v2"

export namespace MessageV2Ext {
  // ========================================================================
  // Extended Part Types (from Claude)
  // ========================================================================

  /**
   * Thinking part - Extended reasoning with signature
   * From Claude's thinking blocks
   */
  export const ThinkingPart = z.object({
    type: z.literal("thinking"),
    id: z.string(),
    sessionID: z.string(),
    messageID: z.string(),
    thinking: z.string(),
    signature: z.string().optional(),
  })
  export type ThinkingPart = z.infer<typeof ThinkingPart>

  /**
   * Redacted thinking - For sensitive reasoning
   * From Claude's redacted_thinking blocks
   */
  export const RedactedThinkingPart = z.object({
    type: z.literal("redacted_thinking"),
    id: z.string(),
    sessionID: z.string(),
    messageID: z.string(),
    data: z.string(),
  })
  export type RedactedThinkingPart = z.infer<typeof RedactedThinkingPart>

  /**
   * Tool use part - Claude style tool invocation
   * Complements Gizzi's ToolPart with state machine
   */
  export const ToolUsePart = z.object({
    type: z.literal("tool_use"),
    id: z.string(),
    sessionID: z.string(),
    messageID: z.string(),
    toolUseId: z.string(),
    name: z.string(),
    input: z.record(z.string(), z.any()),
  })
  export type ToolUsePart = z.infer<typeof ToolUsePart>

  /**
   * Tool result part - Claude style tool result
   * Complements Gizzi's ToolPart
   */
  export const ToolResultPart = z.object({
    type: z.literal("tool_result"),
    id: z.string(),
    sessionID: z.string(),
    messageID: z.string(),
    toolUseId: z.string(),
    content: z.union([z.string(), z.array(z.record(z.string(), z.any()))]),
    isError: z.boolean().optional(),
  })
  export type ToolResultPart = z.infer<typeof ToolResultPart>

  /**
   * Image part - For image content
   * From Claude's image blocks
   */
  export const ImagePart = z.object({
    type: z.literal("image"),
    id: z.string(),
    sessionID: z.string(),
    messageID: z.string(),
    source: z.discriminatedUnion("type", [
      z.object({
        type: z.literal("base64"),
        media_type: z.string(),
        data: z.string(),
      }),
      z.object({
        type: z.literal("url"),
        url: z.string(),
      }),
    ]),
  })
  export type ImagePart = z.infer<typeof ImagePart>

  // ========================================================================
  // Extended Part Union
  // ========================================================================

  /**
   * Extended Part type that includes both Gizzi and Claude content types
   */
  export const Part = z.union([
    // Gizzi types (re-exported for convenience)
    MessageV2.Part.options[0], // TextPart
    MessageV2.Part.options[1], // SubtaskPart
    MessageV2.Part.options[2], // ReasoningPart
    MessageV2.Part.options[3], // FilePart
    MessageV2.Part.options[4], // ToolPart
    MessageV2.Part.options[5], // StepStartPart
    MessageV2.Part.options[6], // StepFinishPart
    MessageV2.Part.options[7], // SnapshotPart
    MessageV2.Part.options[8], // PatchPart
    MessageV2.Part.options[9], // AgentPart
    MessageV2.Part.options[10], // RetryPart
    MessageV2.Part.options[11], // CompactionPart
    // Extended Claude types
    ThinkingPart,
    RedactedThinkingPart,
    ToolUsePart,
    ToolResultPart,
    ImagePart,
  ])
  export type Part = z.infer<typeof Part>

  // ========================================================================
  // Type Guards
  // ========================================================================

  export const Guards = {
    isThinking: (p: MessageV2.Part | Part): p is ThinkingPart =>
      p.type === "thinking",
    isRedactedThinking: (p: MessageV2.Part | Part): p is RedactedThinkingPart =>
      p.type === "redacted_thinking",
    isToolUse: (p: MessageV2.Part | Part): p is ToolUsePart =>
      p.type === "tool_use",
    isToolResult: (p: MessageV2.Part | Part): p is ToolResultPart =>
      p.type === "tool_result",
    isImage: (p: MessageV2.Part | Part): p is ImagePart =>
      p.type === "image",
  }

  // ========================================================================
  // Adapter Functions
  // ========================================================================

  /**
   * Convert extended Part to Gizzi Part (for database storage)
   * Some extended types may need to be converted to equivalent Gizzi types
   */
  export function toGizziPart(part: Part): MessageV2.Part {
    switch (part.type) {
      case "thinking":
        // Map to reasoning part
        return {
          type: "reasoning",
          id: part.id,
          sessionID: part.sessionID,
          messageID: part.messageID,
          text: part.thinking,
          metadata: { signature: part.signature },
          time: { start: Date.now() },
        }
      case "redacted_thinking":
        // Map to reasoning part with redacted flag
        return {
          type: "reasoning",
          id: part.id,
          sessionID: part.sessionID,
          messageID: part.messageID,
          text: "[Redacted thinking]",
          metadata: { redacted: true, data: part.data },
          time: { start: Date.now() },
        }
      case "tool_use":
        // Map to pending tool part
        return {
          type: "tool",
          id: part.id,
          sessionID: part.sessionID,
          messageID: part.messageID,
          callID: part.toolUseId,
          tool: part.name,
          state: {
            status: "pending",
            input: part.input,
            raw: JSON.stringify(part.input),
          },
        }
      case "tool_result":
        // Map to completed tool part (but we need the tool name)
        // This is a partial conversion - tool name would need to come from context
        return {
          type: "tool",
          id: part.id,
          sessionID: part.sessionID,
          messageID: part.messageID,
          callID: part.toolUseId,
          tool: "unknown", // Would need to be resolved from context
          state: {
            status: part.isError ? "error" : "completed",
            input: {},
            output: typeof part.content === "string" ? part.content : JSON.stringify(part.content),
            title: "Tool Result",
            error: part.isError ? String(part.content) : undefined,
            time: { start: Date.now(), end: Date.now() },
          },
        }
      case "image":
        // Map to file part
        return {
          type: "file",
          id: part.id,
          sessionID: part.sessionID,
          messageID: part.messageID,
          mime: part.source.type === "base64" ? part.source.media_type : "image/png",
          url: part.source.type === "base64" 
            ? `data:${part.source.media_type};base64,${part.source.data}`
            : part.source.url,
          filename: undefined,
        }
      default:
        // Already a Gizzi type
        return part as MessageV2.Part
    }
  }

  /**
   * Convert Gizzi Part to extended Part
   */
  export function fromGizziPart(part: MessageV2.Part): Part {
    return part as Part
  }

  /**
   * Convert Claude ContentBlock to extended Part
   */
  export function fromClaudeBlock(
    block: any,
    context: { id: string; sessionID: string; messageID: string }
  ): Part | null {
    switch (block.type) {
      case "text":
        return {
          type: "text",
          ...context,
          text: block.text,
        }
      case "thinking":
        return {
          type: "thinking",
          ...context,
          thinking: block.thinking,
          signature: block.signature,
        }
      case "redacted_thinking":
        return {
          type: "redacted_thinking",
          ...context,
          data: block.data,
        }
      case "tool_use":
        return {
          type: "tool_use",
          ...context,
          toolUseId: block.id || block.toolUseId,
          name: block.name,
          input: block.input,
        }
      case "tool_result":
        return {
          type: "tool_result",
          ...context,
          toolUseId: block.tool_use_id,
          content: block.content,
          isError: block.is_error,
        }
      case "image":
        return {
          type: "image",
          ...context,
          source: block.source,
        }
      default:
        return null
    }
  }

  /**
   * Convert extended Part to Claude ContentBlock
   */
  export function toClaudeBlock(part: Part): any | null {
    switch (part.type) {
      case "text":
        return { type: "text", text: part.text }
      case "thinking":
        return {
          type: "thinking",
          thinking: part.thinking,
          signature: part.signature,
        }
      case "redacted_thinking":
        return { type: "redacted_thinking", data: part.data }
      case "tool_use":
        return {
          type: "tool_use",
          id: part.toolUseId,
          name: part.name,
          input: part.input,
        }
      case "tool_result":
        return {
          type: "tool_result",
          tool_use_id: part.toolUseId,
          content: part.content,
          is_error: part.isError,
        }
      case "image":
        return { type: "image", source: part.source }
      case "reasoning":
        return {
          type: "thinking",
          thinking: part.text,
          signature: part.metadata?.signature as string | undefined,
        }
      case "tool":
        if (part.state.status === "completed") {
          return {
            type: "tool_result",
            tool_use_id: part.callID,
            content: part.state.output,
          }
        }
        if (part.state.status === "pending") {
          return {
            type: "tool_use",
            id: part.callID,
            name: part.tool,
            input: part.state.input,
          }
        }
        return null
      default:
        return null
    }
  }
}
