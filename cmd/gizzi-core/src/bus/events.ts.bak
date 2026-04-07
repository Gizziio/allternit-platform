/**
 * GIZZI Bus Events
 * 
 * Pre-defined event types for the GIZZI event bus.
 */

import { z } from "zod"
import { BusEvent } from "./types"

// Workspace events
export const WorkspaceInitialized = BusEvent.define(
  "workspace.initialized",
  z.object({
    path: z.string(),
    name: z.string(),
  })
)

export const WorkspaceUpdated = BusEvent.define(
  "workspace.updated",
  z.object({
    path: z.string(),
    file: z.string(),
  })
)

// Session events
export const SessionStarted = BusEvent.define(
  "session.started",
  z.object({
    sessionId: z.string(),
    parentId: z.string().optional(),
    workspace: z.string(),
  })
)

export const SessionEnded = BusEvent.define(
  "session.ended",
  z.object({
    sessionId: z.string(),
    duration: z.number(),
  })
)

export const SessionForked = BusEvent.define(
  "session.forked",
  z.object({
    fromSessionId: z.string(),
    toSessionId: z.string(),
  })
)

// Verification events
export const VerificationStarted = BusEvent.define(
  "verification.started",
  z.object({
    verificationId: z.string(),
    type: z.enum(["empirical", "semi-formal"]),
  })
)

export const VerificationCompleted = BusEvent.define(
  "verification.completed",
  z.object({
    verificationId: z.string(),
    success: z.boolean(),
    results: z.array(z.unknown()),
  })
)

// Tool execution events
export const ToolExecuted = BusEvent.define(
  "tool.executed",
  z.object({
    tool: z.string(),
    duration: z.number(),
    success: z.boolean(),
  })
)

// Context events
export const ContextLoaded = BusEvent.define(
  "context.loaded",
  z.object({
    source: z.string(),
    tokens: z.number(),
  })
)

export const ContextModified = BusEvent.define(
  "context.modified",
  z.object({
    source: z.string(),
    change: z.string(),
  })
)
