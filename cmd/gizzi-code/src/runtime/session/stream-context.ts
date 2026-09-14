/**
 * Per-request stream context — carries the gizzi sessionID through the AI SDK
 * streamText pipeline into the subprocess driver, so driver-level events that
 * have no session awareness (ACP permission requests, observed tool calls)
 * can resolve the session they belong to.
 *
 * Set by `session/llm.ts` around the streamText call; read anywhere downstream
 * in the same async call chain (model doStream, driver task assignment, ACP
 * connection callbacks). AsyncLocalStorage propagates through the awaited
 * pipeline, including the ACP stdio read loop started within the context.
 *
 * ALS is not the only source: `streamText` may invoke `doStream` after the
 * `run()` frame returns. Callers also pass `x-gizzi-session` on the request
 * headers; `resolveTaskSessionID` prefers ALS and falls back to that header
 * so the ACP permission gate still sees the session.
 *
 * Never throws: `get()` returns undefined outside a marked context.
 */
import { AsyncLocalStorage } from "node:async_hooks"

export interface StreamContext {
  sessionID: string
}

export const SESSION_HEADER = "x-gizzi-session"

const storage = new AsyncLocalStorage<StreamContext>()

export function runWithStreamContext<T>(context: StreamContext, fn: () => T): T {
  return storage.run(context, fn)
}

export function getStreamContext(): StreamContext | undefined {
  return storage.getStore()
}

/** ALS first, then the request header streamText forwards into doStream. */
export function resolveTaskSessionID(headers?: Record<string, string | undefined>): string | undefined {
  const fromAls = getStreamContext()?.sessionID
  if (fromAls) return fromAls
  const fromHeader = headers?.[SESSION_HEADER] ?? headers?.["X-Gizzi-Session"]
  return fromHeader || undefined
}
