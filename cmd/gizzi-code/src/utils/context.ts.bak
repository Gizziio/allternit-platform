/**
 * Context Utilities
 */

export interface Context {
  sessionId?: string
  projectId?: string
  cwd: string
}

let currentContext: Context = { cwd: process.cwd() }

export function getContext(): Context {
  return currentContext
}

export function setContext(ctx: Partial<Context>): void {
  currentContext = { ...currentContext, ...ctx }
}
