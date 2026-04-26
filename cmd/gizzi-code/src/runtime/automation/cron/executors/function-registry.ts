/**
 * Function Registry
 *
 * Production-safe function dispatch for cron "function" jobs.
 * Dynamic import() of @/ aliases does NOT work in compiled bun binaries,
 * so all internal functions must be registered statically at startup.
 *
 * Usage:
 *   registerFunction("vault-sync", runSync)
 *   registerFunction("vault-live-notes", updateAllLiveNotes)
 *
 * Then in a cron job config:
 *   { type: "function", config: { function: "vault-sync", args: ["gmail"] } }
 */

const registry = new Map<string, (...args: unknown[]) => unknown>()

export function registerFunction(
  name: string,
  fn: (...args: unknown[]) => unknown,
): void {
  if (registry.has(name)) {
    throw new Error(`Function "${name}" is already registered`)
  }
  registry.set(name, fn)
}

export function getFunction(name: string): ((...args: unknown[]) => unknown) | undefined {
  return registry.get(name)
}

export function listRegisteredFunctions(): string[] {
  return Array.from(registry.keys())
}

export function unregisterFunction(name: string): boolean {
  return registry.delete(name)
}
