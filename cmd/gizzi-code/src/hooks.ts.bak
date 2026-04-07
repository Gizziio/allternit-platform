/**
 * Hooks System
 */

export interface HookContext {
  event: string
  data: unknown
}

export type HookCallback = (ctx: HookContext) => void | Promise<void>

const hooks: Map<string, HookCallback[]> = new Map()

export function registerHook(event: string, callback: HookCallback): () => void {
  if (!hooks.has(event)) {
    hooks.set(event, [])
  }
  hooks.get(event)!.push(callback)
  return () => {
    const callbacks = hooks.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index >= 0) callbacks.splice(index, 1)
    }
  }
}

export async function executeHooks(event: string, data: unknown): Promise<void> {
  const callbacks = hooks.get(event) || []
  for (const callback of callbacks) {
    await callback({ event, data })
  }
}

export function hasWorktreeCreateHook(): boolean {
  return hooks.has('worktree:create')
}
