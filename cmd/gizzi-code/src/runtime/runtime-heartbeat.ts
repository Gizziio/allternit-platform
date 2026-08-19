import { existsSync } from "node:fs"
import { RuntimeService } from "@/runtime/runtime-service"
import { discoverLocalRuntime } from "@/runtime/runtime-discovery"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "runtime-heartbeat" })

let intervalId: ReturnType<typeof setInterval> | undefined

async function beat() {
  const runtimes = await RuntimeService.list()
  const now = Date.now()

  for (const runtime of runtimes) {
    if (runtime.transport === "local") {
      try {
        const discovered = await discoverLocalRuntime(runtime.host)
        const stillHasClis = runtime.agentClis.every((cli) =>
          discovered.agentClis.some((d) => d.name === cli.name),
        )

        if (!stillHasClis && runtime.agentClis.length > 0) {
          log.warn("runtime lost CLIs", { id: runtime.id, host: runtime.host })
          await RuntimeService.markOffline(runtime.id)
          continue
        }

        await RuntimeService.upsertByHost(discovered, { name: runtime.name })
      } catch (err) {
        log.error("heartbeat failed", { id: runtime.id, error: err })
        await RuntimeService.markOffline(runtime.id)
      }
      continue
    }

    // For non-local transports, just update heartbeat if we have a cheap way to check.
    // WebSocket/UDS health checks are implemented by their drivers in Phase 3.
    if (runtime.lastHeartbeatAt && now - runtime.lastHeartbeatAt > 120_000) {
      await RuntimeService.markOffline(runtime.id)
    }
  }
}

export namespace RuntimeHeartbeat {
  export function start(intervalMs = 30_000) {
    if (intervalId) return
    log.info("starting runtime heartbeat", { intervalMs })
    intervalId = setInterval(beat, intervalMs)
    // Run an initial beat shortly after startup.
    setTimeout(beat, 1000)
  }

  export function stop() {
    if (!intervalId) return
    clearInterval(intervalId)
    intervalId = undefined
    log.info("stopped runtime heartbeat")
  }

  export function active(): boolean {
    return intervalId !== undefined
  }
}
