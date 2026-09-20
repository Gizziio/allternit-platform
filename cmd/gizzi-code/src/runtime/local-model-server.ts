/**
 * Local model server manager.
 *
 * Owns the lifecycle of per-model local inference servers (mlx_lm.server,
 * or any OpenAI-compatible server binary) for config-defined local providers
 * (e.g. `local-mlx`). A model opts in by setting `options.modelPath` on its
 * entry in `~/.config/gizzi-code/gizzi.json`:
 *
 *     "local-mlx": {
 *       "options": { "baseURL": "http://localhost:8081/v1" },
 *       "models": {
 *         "gemma-3-4b-it-4bit": {
 *           "options": { "modelPath": "/Users/joe/models/gemma-3-4b-it-4bit" }
 *         }
 *       }
 *     }
 *
 * Contract (owner requirement: no daemons outlive the session):
 * - First request for a managed model spawns the server and waits for it.
 * - Switching to a different managed model on the same provider kills the
 *   previous server before starting the new one.
 * - Clean exit (SIGINT/SIGTERM/close) reaps everything via ProcessRegistry.
 * - Abrupt termination (SIGKILL, power loss): the child survives the parent,
 *   so a state file under GlobalPaths.state records what we started. The
 *   next ensure() either adopts the orphan (same model — avoids a long
 *   reload) or kills it (different model), and tracks it in ProcessRegistry
 *   so this session still reaps it on exit. A server on the provider's port
 *   that we did not start is adopted only if it provably serves the requested
 *   model AND its pid can be identified — otherwise ensure() fails rather
 *   than risk killing a foreign process.
 */

import { spawn, execFileSync, type ChildProcess } from "node:child_process"
import { openSync, rm as fsRm } from "node:fs"
import path from "node:path"
import { Log } from "@/shared/util/log"
import { Filesystem } from "@/shared/util/filesystem"
import { GlobalPaths } from "@/runtime/context/global/paths"
import { killProcessTree, ProcessRegistry } from "@/runtime/process-registry"

const log = Log.create({ service: "local-model-server" })

export type LocalServerRef = {
  providerID: string
  modelID: string
}

export type EnsureResult =
  | { managed: false }
  | { managed: true; reused: boolean; pid: number }

type ServerState = {
  pid: number
  modelPath: string
  port: number
  log: string
  startedAt: number
}

/** Optional per-model overrides (model `options` in gizzi.json). */
export type ManagedModelOptions = {
  modelPath?: string
  /** Full command override, e.g. "mlx_lm.server" or "python3 -m mlx_lm.server". */
  serverCmd?: string
  /** Startup wait in ms (model load time). Default 300_000. */
  startupTimeoutMs?: number
}

/** The subset of the gizzi.json provider block this manager reads. */
export type ManagedProviderConfig = {
  options?: Record<string, unknown>
  models?: Record<string, { options?: Record<string, unknown> } | undefined>
}

type Spawned = {
  pid: number
  exit: Promise<{ code: number | null }>
  kill: (signal?: NodeJS.Signals) => void
}

export type LocalModelServerDeps = {
  /** Directory holding per-provider state files. Injected in tests. */
  stateDir: string
  fetchImpl: typeof fetch
  spawnImpl: (argv: string[], opts: { logFile: string }) => Spawned
  /** Resolve a command name to an absolute path, or null if not found. */
  which: (cmd: string) => Promise<string | null>
  sleep: (ms: number) => Promise<void>
  now: () => number
  isAlive: (pid: number) => boolean
  /** Kill a pid we own (spawned or adopted). */
  kill: (pid: number) => void
  defaultStartupTimeoutMs: number
  /** Best-effort pid of the process listening on a port (undefined = unknown). */
  listenerPid: (port: number) => number | undefined
}

function spawnToLog(argv: string[], logFile: string): Spawned {
  // stdio goes straight to the log file — NOT through a parent-held pipe.
  // A pipe breaks when gizzi is SIGKILLed; the next server write would take
  // SIGPIPE and wedge the orphan. A file descriptor keeps the daemon
  // serving so the next session can adopt it.
  const fd = openSync(logFile, "a")
  const child: ChildProcess = spawn(argv[0], argv.slice(1), {
    detached: process.platform !== "win32",
    stdio: ["ignore", fd, fd],
  })
  return {
    pid: child.pid ?? 0,
    exit: new Promise((resolve) => child.once("exit", (code) => resolve({ code }))),
    kill: (signal) => {
      try {
        child.kill(signal)
      } catch {
        // already gone
      }
    },
  }
}

function whichCommand(cmd: string): string | null {
  try {
    const found = execFileSync("which", [cmd], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
    return found || null
  } catch {
    return null
  }
}

function lsofListenerPid(port: number): number | undefined {
  if (process.platform === "win32") return undefined
  try {
    const out = execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    const pid = Number(out.split("\n")[0])
    return Number.isFinite(pid) && pid > 0 ? pid : undefined
  } catch {
    return undefined
  }
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const realDeps: LocalModelServerDeps = {
  stateDir: path.join(GlobalPaths.state, "local-model-server"),
  fetchImpl: fetch,
  spawnImpl: (argv, opts) => spawnToLog(argv, opts.logFile),
  which: async (cmd) => whichCommand(cmd),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => Date.now(),
  isAlive: pidAlive,
  kill: (pid) => killProcessTree(pid, process.platform !== "win32"),
  defaultStartupTimeoutMs: 300_000,
  listenerPid: lsofListenerPid,
}

function safeName(providerID: string): string {
  return providerID.replace(/[^a-zA-Z0-9._-]/g, "_")
}

function stateFile(deps: LocalModelServerDeps, providerID: string): string {
  return path.join(deps.stateDir, `${safeName(providerID)}.json`)
}

async function readState(deps: LocalModelServerDeps, providerID: string): Promise<ServerState | undefined> {
  try {
    const raw = await Filesystem.readJson<ServerState>(stateFile(deps, providerID))
    if (typeof raw?.pid === "number" && typeof raw?.modelPath === "string" && typeof raw?.port === "number") {
      return raw
    }
  } catch {
    // missing or corrupt — treat as no state
  }
  return undefined
}

async function writeState(deps: LocalModelServerDeps, providerID: string, state: ServerState): Promise<void> {
  await Filesystem.write(stateFile(deps, providerID), JSON.stringify(state, null, 2))
}

async function clearState(deps: LocalModelServerDeps, providerID: string): Promise<void> {
  await new Promise<void>((resolve) => fsRm(stateFile(deps, providerID), { force: true }, () => resolve()))
}

function baseURLPort(baseURL: string): number | undefined {
  try {
    const url = new URL(baseURL)
    return Number(url.port || (url.protocol === "https:" ? 443 : 80))
  } catch {
    return undefined
  }
}

async function probeModels(deps: LocalModelServerDeps, baseURL: string): Promise<string[] | undefined> {
  try {
    const res = await deps.fetchImpl(`${baseURL.replace(/\/$/, "")}/models`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return undefined
    const json = (await res.json()) as { data?: { id?: string }[] }
    const ids = (json.data ?? []).map((m) => m.id ?? "")
    // An endpoint with zero models is treated as not serving — some servers
    // answer /models before any model is loaded.
    return ids.length > 0 ? ids : undefined
  } catch {
    return undefined
  }
}

/** The served id matches when it is, or ends with, the configured path —
 * mlx_lm.server reports the absolute --model path it was started with. */
export function servedModelMatches(served: string[], modelPath: string): boolean {
  const normalized = modelPath.replace(/\/$/, "")
  return served.some(
    (id) => id === normalized || id.endsWith(normalized) || id.endsWith("/" + path.basename(normalized)),
  )
}

export function createLocalModelServerManager(deps: LocalModelServerDeps) {
  // Serialize ensure() per provider — concurrent first requests must not
  // double-spawn.
  const locks = new Map<string, Promise<void>>()

  async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = locks.get(key) ?? Promise.resolve()
    let release!: () => void
    const next = new Promise<void>((r) => (release = r))
    locks.set(key, prev.then(() => next))
    await prev
    try {
      return await fn()
    } finally {
      release()
      if (locks.get(key) === next) locks.delete(key)
    }
  }

  /** Resolve the server argv, honoring the serverCmd override. */
  async function resolveArgv(serverCmd: string | undefined): Promise<string[] | undefined> {
    if (serverCmd) {
      const parts = serverCmd.split(/\s+/).filter(Boolean)
      return parts.length > 0 ? parts : undefined
    }
    const bin = await deps.which("mlx_lm.server")
    if (bin) return [bin]
    return ["python3", "-m", "mlx_lm.server"]
  }

  function trackOwnership(providerID: string, pid: number): void {
    ProcessRegistry.install()
    ProcessRegistry.track({ pid }, { label: `local-model-server:${providerID}`, group: false })
  }

  async function killAndClear(providerID: string, pid: number, reason: string): Promise<void> {
    log.info("killing local model server", { providerID, pid, reason })
    deps.kill(pid)
    await clearState(deps, providerID)
  }

  async function spawnAndWait(
    providerID: string,
    modelID: string,
    modelPath: string,
    port: number,
    baseURL: string,
    opts: ManagedModelOptions,
  ): Promise<number> {
    const argv = await resolveArgv(opts.serverCmd)
    if (!argv) throw new Error(`${providerID}/${modelID}: invalid serverCmd`)

    await Filesystem.mkdir(deps.stateDir, { recursive: true })
    const logFile = path.join(deps.stateDir, `${safeName(providerID)}.log`)

    log.info("starting local model server", { providerID, modelID, modelPath, port, argv: argv.join(" ") })
    const child = deps.spawnImpl([...argv, "--model", modelPath, "--port", String(port)], { logFile })
    if (!child.pid) throw new Error(`${providerID}/${modelID}: server failed to start (no pid)`)

    ProcessRegistry.install()
    ProcessRegistry.track(
      { pid: child.pid, kill: (s) => child.kill(s as NodeJS.Signals) },
      { label: `local-model-server:${providerID}`, group: process.platform !== "win32" },
    )

    const startedAt = deps.now()
    await writeState(deps, providerID, { pid: child.pid, modelPath, port, log: logFile, startedAt })

    const timeoutMs = opts.startupTimeoutMs ?? deps.defaultStartupTimeoutMs
    const deadline = startedAt + timeoutMs
    const exited = child.exit.then(({ code }) => `exited with code ${code ?? "null"}`)

    while (deps.now() < deadline) {
      const models = await probeModels(deps, baseURL)
      if (models) {
        log.info("local model server ready", { providerID, modelID, pid: child.pid })
        return child.pid
      }
      const early = await Promise.race([exited.then((msg) => msg), deps.sleep(1000).then(() => undefined)])
      if (early) {
        await clearState(deps, providerID)
        throw new Error(`${providerID}/${modelID}: server ${early} during startup (log: ${logFile})`)
      }
    }

    await killAndClear(providerID, child.pid, "startup-timeout")
    throw new Error(`${providerID}/${modelID}: server not ready within ${Math.round(timeoutMs / 1000)}s (log: ${logFile})`)
  }

  /**
   * Ensure the server for `ref` is running and serving `modelPath`.
   * `configProvider` is the provider block from gizzi.json (injected in
   * tests); models without `options.modelPath` are unmanaged BYOS and pass
   * straight through.
   */
  async function ensure(ref: LocalServerRef, configProvider: ManagedProviderConfig | undefined): Promise<EnsureResult> {
    const modelCfg = configProvider?.models?.[ref.modelID]
    const opts = (modelCfg?.options ?? {}) as ManagedModelOptions
    const modelPath = opts.modelPath
    const baseURL = (configProvider?.options?.baseURL ?? "") as string
    if (!modelPath || !baseURL) return { managed: false }

    const port = baseURLPort(baseURL)
    if (!port) throw new Error(`${ref.providerID}/${ref.modelID}: cannot parse port from baseURL "${baseURL}"`)

    return withLock(ref.providerID, async () => {
      // 1. Reconcile our own state file (covers abrupt-termination orphans).
      const state = await readState(deps, ref.providerID)
      if (state) {
        if (deps.isAlive(state.pid)) {
          if (state.modelPath === modelPath) {
            const models = await probeModels(deps, baseURL)
            if (models) {
              // Orphan from a killed session, same model — adopt so this
              // session's exit cleanup reaps it too.
              log.info("adopting orphaned local model server", { providerID: ref.providerID, pid: state.pid })
              trackOwnership(ref.providerID, state.pid)
              return { managed: true, reused: true, pid: state.pid }
            }
            // Alive but wedged — kill and restart below.
            await killAndClear(ref.providerID, state.pid, "unhealthy")
          } else {
            // Model switch — cleanup on switching.
            await killAndClear(ref.providerID, state.pid, "model-switch")
          }
        } else {
          await clearState(deps, ref.providerID)
        }
      }

      // 2. Port already answering without our state — adopt only if it
      // provably serves the requested model AND its pid is identifiable;
      // otherwise refuse rather than risk touching a foreign process.
      const models = await probeModels(deps, baseURL)
      if (models) {
        if (servedModelMatches(models, modelPath)) {
          const pid = deps.listenerPid(port)
          if (pid !== undefined && pid !== process.pid) {
            log.info("adopting existing local model server", { providerID: ref.providerID, pid, modelPath })
            trackOwnership(ref.providerID, pid)
            await writeState(deps, ref.providerID, {
              pid,
              modelPath,
              port,
              log: path.join(deps.stateDir, `${safeName(ref.providerID)}.log`),
              startedAt: deps.now(),
            })
            return { managed: true, reused: true, pid }
          }
          throw new Error(
            `${ref.providerID}/${ref.modelID}: port ${port} serves this model but its process is unknown — ` +
              `kill it manually so gizzi can manage its own server`,
          )
        }
        throw new Error(
          `${ref.providerID}/${ref.modelID}: port ${port} is occupied by a server serving [${models.join(", ")}] ` +
            `that gizzi-code did not start — free the port or pick another`,
        )
      }

      // 3. Spawn and wait.
      const pid = await spawnAndWait(ref.providerID, ref.modelID, modelPath, port, baseURL, opts)
      return { managed: true, reused: false, pid }
    })
  }

  return { ensure }
}

export const LocalModelServer = createLocalModelServerManager(realDeps)
