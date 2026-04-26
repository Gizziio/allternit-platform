import { cmd } from "@/cli/commands/cmd"
import { tui } from "@/cli/ui/ink-app/app"
import { Rpc } from "@/shared/util/rpc"
import { type rpc } from "@/cli/ui/ink-app/worker"
import path from "path"
import { fileURLToPath } from "url"
import { iife } from "@/shared/util/iife"
import { Log } from "@/shared/util/log"
import { withNetworkOptions, resolveNetworkOptions } from "@/cli/network"
import { Filesystem } from "@/shared/util/filesystem"
import type { EventSource } from "@/cli/ui/ink-app/context/sdk"
import { win32DisableProcessedInput, win32InstallCtrlCGuard } from "@/cli/ui/ink-app/win32"

// Local Event type since SDK Event is now unknown
type Event = any

declare global {
  const GIZZI_WORKER_PATH: string
}

type RpcClient = ReturnType<typeof Rpc.client<typeof rpc>>

function createWorkerFetch(client: RpcClient): typeof fetch {
  const fn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init)
    const body = request.body ? await request.text() : undefined
    try {
      const result = await client.call("fetch", {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body,
      })
      return new Response(result.body, {
        status: result.status,
        headers: result.headers,
      })
    } catch (e) {
      // Worker threw — return a 503 so the SDK gets a real HTTP error response
      // instead of a hanging promise
      Log.Default.error("tui: worker fetch failed", { url: request.url, error: e })
      return new Response(JSON.stringify({ message: e instanceof Error ? e.message : String(e) }), {
        status: 503,
        headers: { "content-type": "application/json" },
      })
    }
  }
  return fn as typeof fetch
}

function createEventSource(client: RpcClient): EventSource {
  return {
    on: (handler) => client.on<Event>("event", handler),
  }
}

export const TuiThreadCommand = cmd({
  command: "$0 [project]",
  describe: "start gizzi-code tui",
  builder: (yargs) =>
    withNetworkOptions(yargs)
      .positional("project", {
        type: "string",
        describe: "path to start gizzi-code in",
      })
      .option("model", {
        type: "string",
        alias: ["m"],
        describe: "model to use in the format of provider/model",
      })
      .option("continue", {
        alias: ["c"],
        describe: "continue the last session",
        type: "boolean",
      })
      .option("session", {
        alias: ["s"],
        type: "string",
        describe: "session id to continue",
      })
      .option("fork", {
        type: "boolean",
        describe: "fork the session when continuing (use with --continue or --session)",
      })
      .option("prompt", {
        type: "string",
        describe: "prompt to use",
      })
      .option("agent", {
        type: "string",
        describe: "agent to use",
      }),
  handler: async (args) => {
    // Keep ENABLE_PROCESSED_INPUT cleared even if other code flips it.
    // (Important when running under `bun run` wrappers on Windows.)
    const unguard = win32InstallCtrlCGuard()
    try {
      // Must be the very first thing — disables CTRL_C_EVENT before any Worker
      // spawn or async work so the OS cannot kill the process group.
      win32DisableProcessedInput()

      if (args.fork && !args.continue && !args.session) {
        console.error("--fork requires --continue or --session")
        process.exitCode = 1
        return
      }

      // Resolve relative paths against PWD to preserve behavior when using --cwd flag
      const baseCwd = process.env.PWD ?? process.cwd()
      const cwd = args.project ? path.resolve(baseCwd, args.project) : process.cwd()
      const localWorker = new URL("./worker.ts", import.meta.url)
      const distWorker = new URL("./worker.js", import.meta.url)
      const workerPath = await iife(async () => {
        if (typeof GIZZI_WORKER_PATH !== "undefined") return GIZZI_WORKER_PATH
        if (await Filesystem.exists(fileURLToPath(distWorker))) return distWorker
        return localWorker
      })
      Log.Default.info("tui: using worker path", { workerPath: workerPath.toString() })
      try {
        process.chdir(cwd)
      } catch (e) {
        console.error("Failed to change directory to " + cwd)
        process.exitCode = 1
        return
      }

      Log.Default.info("tui: spawning worker")
      const worker = new Worker(workerPath, {
        env: Object.fromEntries(
          Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
        ),
      })
      Log.Default.info("tui: worker spawned")
      worker.onerror = (e) => {
        Log.Default.error("tui: worker error", e)
      }
      const client = Rpc.client<typeof rpc>(worker)
      Log.Default.info("tui: rpc client created")
      process.on("uncaughtException", (e) => {
        Log.Default.error(e)
      })
      process.on("unhandledRejection", (e) => {
        Log.Default.error(e)
      })
      process.on("SIGUSR2", async () => {
        await client.call("reload", undefined)
      })

      const prompt = await iife(async () => {
        const piped = !process.stdin.isTTY ? await Bun.stdin.text() : undefined
        if (!args.prompt) return piped
        return piped ? piped + "\n" + args.prompt : args.prompt
      })

      // Check if server should be started (port or hostname explicitly set in CLI or config)
      const networkOpts = await resolveNetworkOptions(args)
      const shouldStartServer =
        process.argv.includes("--port") ||
        process.argv.includes("--hostname") ||
        process.argv.includes("--mdns") ||
        networkOpts.mdns ||
        networkOpts.port !== 0 ||
        networkOpts.hostname !== "127.0.0.1"

      let url: string
      let customFetch: typeof fetch | undefined
      let events: EventSource | undefined

      if (shouldStartServer) {
        // Start HTTP server for external access
        Log.Default.info("tui: starting http server via worker")
        const server = await client.call("server", networkOpts)
        url = server.url
        Log.Default.info("tui: http server started", { url })
      } else {
        // Use direct RPC communication (no HTTP)
        Log.Default.info("tui: using direct rpc")
        url = "http://gizzi.internal"
        customFetch = createWorkerFetch(client)
        events = createEventSource(client)
      }

      Log.Default.info("tui: calling tui() entry point")
      const tuiPromise = tui({
        url,
        fetch: customFetch,
        events,
        args: {
          continue: args.continue,
          sessionID: args.session,
          agent: args.agent,
          model: args.model,
          prompt,
          fork: args.fork,
        },
        onExit: async () => {
          await client.call("shutdown", undefined)
          // Note: Session exits have telemetry shown via exit.message in session/index.tsx
          // This is for non-session exits (home screen, etc)
        },
      })

      setTimeout(() => {
        client.call("checkUpgrade", { directory: cwd }).catch(() => {})
      }, 1000)

      await tuiPromise
    } finally {
      unguard?.()
    }
    process.exit(0)
  },
})
