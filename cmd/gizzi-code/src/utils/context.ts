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

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export * from '../shared/utils/context.js'
