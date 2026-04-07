/**
 * Runtime Context
 */

export interface RuntimeContext {
  sessionId?: string
  projectId?: string
  cwd: string
}

let currentContext: RuntimeContext = { cwd: process.cwd() }

export function getContext(): RuntimeContext {
  return currentContext
}

export function setContext(ctx: Partial<RuntimeContext>): void {
  currentContext = { ...currentContext, ...ctx }
}
