import type { Hooks, PluginInput, Plugin as PluginInstance } from "@allternit/plugin"
import { Config } from "@/runtime/context/config/config"
import { Bus } from "@/runtime/bus/bus"
import { Log } from "@/runtime/util/log"
import { createAllternitClient } from "@allternit/sdk"
import { Server } from "@/runtime/server/server"
import { BunProc } from "@/shared/bun/bun"
import { Instance } from "@/runtime/context/project/instance"
import { Flag } from "@/runtime/context/flag/flag"
import { CodexAuthPlugin } from "@/runtime/integrations/plugin/codex"
import { Session } from "@/runtime/session/session"
import { NamedError } from "@allternit/util/error"

// Extend Hooks interface to include optional name property
interface HooksWithName extends Hooks {
  name?: string
}

export namespace Plugin {
  const log = Log.create({ service: "plugin" })

  const BUILTIN: string[] = []

  // Per-session disabled plugin tracking
  const disabledPlugins = new Set<string>()

  const state = Instance.state(async () => {
    const client = createAllternitClient({
      baseUrl: "http://localhost:4096",
      directory: Instance.directory,
      fetch: ((input: URL | RequestInfo, init?: RequestInit) => Server.App().fetch(input as Request, init)) as typeof fetch,
    })
    const config = await Config.get()
    const hooks: HooksWithName[] = []
    const input: PluginInput = {
      client: client as any,
      project: Instance.project as unknown as string,
      worktree: Instance.worktree as unknown as string,
      directory: Instance.directory,
      serverUrl: String(Server.url()),
      $: Bun.$,
    }

    // Load built-in Codex auth plugin
    try {
      const codex = await CodexAuthPlugin(input)
      if (codex) hooks.push(codex as HooksWithName)
    } catch (err) {
      log.error("failed to load CodexAuthPlugin", { error: err })
    }

    const plugins = (config as any).plugin ?? []
    if (plugins.length) await Config.waitForDependencies()
    if (!Flag.GIZZI_DISABLE_DEFAULT_PLUGINS) {
      plugins.unshift(...BUILTIN)
    }

    for (let plugin of plugins) {
      // ignore old codex plugin since it is supported first party now
      if (plugin.includes("opencode-openai-codex-auth")) continue
      log.info("loading plugin", { path: plugin })
      if (!plugin.startsWith("file://")) {
        const lastAtIndex = plugin.lastIndexOf("@")
        const pkg = lastAtIndex > 0 ? plugin.substring(0, lastAtIndex) : plugin
        const version = lastAtIndex > 0 ? plugin.substring(lastAtIndex + 1) : "latest"
        plugin = await BunProc.install(pkg, version).catch((err) => {
          const cause = err instanceof Error ? err.cause : err
          const detail = cause instanceof Error ? cause.message : String(cause ?? err)
          log.error("failed to install plugin", { pkg, version, error: detail })
          Bus.publish(Session.Event.Error, {
            error: { name: "Unknown", message: `Failed to install plugin ${pkg}@${version}: ${detail}`, data: {} },
          })
          return ""
        })
        if (!plugin) continue
      }
      // Prevent duplicate initialization when plugins export the same function
      // as both a named export and default export (e.g., `export const X` and `export default X`).
      // Object.entries(mod) would return both entries pointing to the same function reference.
      await import(plugin)
        .then(async (mod) => {
          const seen = new Set<PluginInstance>()
          for (const [_name, fn] of Object.entries<PluginInstance>(mod)) {
            if (seen.has(fn)) continue
            seen.add(fn)
            hooks.push(await fn(input) as HooksWithName)
          }
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err)
          log.error("failed to load plugin", { path: plugin, error: message })
          Bus.publish(Session.Event.Error, {
            error: { name: "Unknown", message: `Failed to load plugin ${plugin}: ${message}`, data: {} },
          })
        })
    }

    return {
      hooks,
      input,
    }
  })

  export async function trigger<
    Name extends Exclude<keyof Required<Hooks>, "auth" | "event" | "tool">,
    Input = Parameters<Required<Hooks>[Name]>[0],
    Output = Parameters<Required<Hooks>[Name]>[1],
  >(name: Name, input: Input, output: Output): Promise<Output> {
    if (!name) return output
    for (const hook of await state().then((x) => x.hooks)) {
      if (hook.name && disabledPlugins.has(hook.name)) continue
      const fn = hook[name]
      if (!fn) continue
      await (fn as Function)(input, output)
    }
    return output
  }

  export async function list() {
    return state().then((x) => x.hooks)
  }

  export function disable(name: string) {
    disabledPlugins.add(name)
    log.info("plugin disabled for session", { name })
  }

  export function enable(name: string) {
    disabledPlugins.delete(name)
    log.info("plugin re-enabled for session", { name })
  }

  export async function listEnabled(): Promise<string[]> {
    const hooks = await state().then((x) => x.hooks)
    return hooks
      .map((h) => h.name)
      .filter((n): n is string => !!n && !disabledPlugins.has(n))
  }

  export async function init() {
    const hooks = await state().then((x) => x.hooks)
    const config = await Config.get()
    for (const hook of hooks) {
      await (hook as any).config?.(config)
    }
    Bus.subscribeAll(async (input) => {
      const hooks = await state().then((x) => x.hooks)
      for (const hook of hooks) {
        hook["event"]?.({
          event: input,
        })
      }
    })
  }
}
