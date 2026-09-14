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
 * Never throws: `get()` returns undefined outside a marked context.
 */
import { AsyncLocalStorage } from "node:async_hooks"

export interface StreamContext {
  sessionID: string
}

const storage = new AsyncLocalStorage<StreamContext>()

export function runWithStreamContext<T>(context: StreamContext, fn: () => T): T {
  return storage.run(context, fn)
}

export function getStreamContext(): StreamContext | undefined {
  return storage.getStore()
}
