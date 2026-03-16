/**
 * Embedded Model Sidecar
 *
 * Ships a local quantized model (Qwen 3.5 4B Q4_K_M) with gizzi-code.
 * On first run, auto-pulls weights to ~/.local/share/gizzi-code/models/.
 * Starts an Ollama-compatible inference server as a daemon process.
 * Used for background tasks: title generation, compaction, summaries.
 */

import { spawn, type ChildProcess } from "child_process"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { Log } from "@/shared/util/log"
import { Global } from "@/runtime/context/global"
import { Filesystem } from "@/shared/util/filesystem"

const log = Log.create({ service: "sidecar" })

const SIDECAR_PORT = 11435
const SIDECAR_HOST = "127.0.0.1"
/**
 * If A2R_SIDECAR_URL is set (e.g. "http://my-vps.example.com:11434"),
 * the sidecar skips local Ollama startup and points directly at the remote server.
 */
const REMOTE_SIDECAR_URL = process.env["A2R_SIDECAR_URL"]?.replace(/\/$/, "")
/**
 * Set A2R_SIDECAR_DISABLED=1 to skip sidecar startup entirely.
 * Useful on low-resource VMs or environments where local Ollama is unavailable/undesirable.
 */
const SIDECAR_DISABLED = process.env["A2R_SIDECAR_DISABLED"] === "1" || process.env["A2R_SIDECAR_DISABLED"] === "true"

// Default embedded model — shipped with gizzi-code
const EMBEDDED_MODEL = {
  id: "qwen3.5:4b",
  name: "Qwen 3.5 4B (Embedded)",
  // Ollama model identifier for pulling
  ollamaTag: "qwen3:4b",
  contextLength: 32768,
  outputLimit: 4096,
}

export namespace Sidecar {
  export const Port = SIDECAR_PORT
  export const Host = SIDECAR_HOST
  export const BaseURL = REMOTE_SIDECAR_URL
    ? `${REMOTE_SIDECAR_URL}/v1`
    : `http://${SIDECAR_HOST}:${SIDECAR_PORT}/v1`
  export const Model = EMBEDDED_MODEL

  const paths = {
    get root() {
      return path.join(Global.Path.data, "sidecar")
    },
    get pid() {
      return path.join(Global.Path.data, "sidecar", "sidecar.pid")
    },
    get log() {
      return path.join(Global.Path.data, "sidecar", "sidecar.log")
    },
    get ready() {
      return path.join(Global.Path.data, "sidecar", "ready")
    },
  }

  /**
   * Check if Ollama is installed on the system
   */
  async function findOllama(): Promise<string | null> {
    const candidates = [
      "/usr/local/bin/ollama",
      "/opt/homebrew/bin/ollama",
      path.join(os.homedir(), ".ollama", "bin", "ollama"),
      "ollama", // PATH fallback
    ]

    for (const candidate of candidates) {
      try {
        const proc = Bun.spawn(["which", candidate], { stdout: "pipe", stderr: "pipe" })
        const code = await proc.exited
        if (code === 0) {
          const out = await new Response(proc.stdout).text()
          return out.trim() || candidate
        }
      } catch {}

      // Direct existence check for absolute paths
      if (candidate.startsWith("/")) {
        if (await Filesystem.exists(candidate)) return candidate
      }
    }

    return null
  }

  /**
   * Check if sidecar server is already running and healthy
   */
  export async function isRunning(): Promise<boolean> {
    try {
      const resp = await fetch(`http://${SIDECAR_HOST}:${SIDECAR_PORT}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      })
      return resp.ok
    } catch {
      return false
    }
  }

  /**
   * Check if the embedded model is pulled
   */
  async function isModelPulled(): Promise<boolean> {
    try {
      const resp = await fetch(`http://${SIDECAR_HOST}:${SIDECAR_PORT}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      })
      if (!resp.ok) return false
      const data = (await resp.json()) as { models?: Array<{ name: string }> }
      return data.models?.some((m) => m.name.includes(EMBEDDED_MODEL.ollamaTag)) ?? false
    } catch {
      return false
    }
  }

  /**
   * Pull the embedded model weights
   */
  async function pullModel(ollamaBin: string): Promise<boolean> {
    log.info("pulling embedded model", { model: EMBEDDED_MODEL.ollamaTag })

    return new Promise((resolve) => {
      const env = {
        ...process.env,
        OLLAMA_HOST: `${SIDECAR_HOST}:${SIDECAR_PORT}`,
      }

      const child = spawn(ollamaBin, ["pull", EMBEDDED_MODEL.ollamaTag], {
        env,
        stdio: ["ignore", "pipe", "pipe"],
      })

      let stderr = ""
      child.stderr?.on("data", (d) => (stderr += d.toString()))

      child.on("close", (code) => {
        if (code === 0) {
          log.info("embedded model pulled successfully", { model: EMBEDDED_MODEL.ollamaTag })
          resolve(true)
        } else {
          log.error("failed to pull embedded model", { code, stderr: stderr.slice(-500) })
          resolve(false)
        }
      })

      child.on("error", (err) => {
        log.error("pull process error", { error: err.message })
        resolve(false)
      })

      // 10 minute timeout for pulling
      setTimeout(() => {
        try {
          child.kill()
        } catch {}
        log.error("pull timed out")
        resolve(false)
      }, 600_000)
    })
  }

  /**
   * Start the Ollama sidecar server as a detached daemon
   */
  async function startServer(ollamaBin: string): Promise<boolean> {
    await fs.mkdir(paths.root, { recursive: true })

    // Clean stale ready marker
    await fs.rm(paths.ready, { force: true }).catch(() => {})

    const logFile = Bun.file(paths.log)
    const logFd = logFile.writer()

    const env = {
      ...process.env,
      OLLAMA_HOST: `${SIDECAR_HOST}:${SIDECAR_PORT}`,
      OLLAMA_MODELS: path.join(Global.Path.data, "models"),
      // Limit resource usage — this is a background sidecar
      OLLAMA_NUM_PARALLEL: "1",
      OLLAMA_MAX_LOADED_MODELS: "1",
      OLLAMA_KEEP_ALIVE: "5m",
    }

    log.info("starting sidecar", { port: SIDECAR_PORT, bin: ollamaBin })

    const child = spawn(ollamaBin, ["serve"], {
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    })

    if (!child.pid) {
      log.error("failed to start sidecar — no PID")
      return false
    }

    // Write PID file
    await Filesystem.write(paths.pid, String(child.pid))

    // Pipe output to log file
    child.stdout?.on("data", (d) => logFd.write(d))
    child.stderr?.on("data", (d) => logFd.write(d))
    child.unref()

    // Wait for server to be ready (up to 15 seconds)
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500))
      if (await isRunning()) {
        await Filesystem.write(paths.ready, String(Date.now()))
        log.info("sidecar ready", { pid: child.pid, port: SIDECAR_PORT })
        return true
      }
    }

    log.error("sidecar failed to become ready within 15 seconds")
    return false
  }

  /**
   * Stop the sidecar daemon
   */
  export async function stop(): Promise<void> {
    try {
      const pidStr = await Filesystem.readText(paths.pid)
      const pid = parseInt(pidStr, 10)
      if (!isNaN(pid)) {
        process.kill(pid, "SIGTERM")
        log.info("sidecar stopped", { pid })
      }
    } catch {}

    await fs.rm(paths.pid, { force: true }).catch(() => {})
    await fs.rm(paths.ready, { force: true }).catch(() => {})
  }

  /**
   * Ensure the sidecar is running and the model is available.
   * Called during bootstrap — non-blocking for the main CLI.
   */
  export async function ensure(): Promise<{
    available: boolean
    baseURL: string
    modelID: string
  }> {
    const result = { available: false, baseURL: BaseURL, modelID: EMBEDDED_MODEL.id }

    if (SIDECAR_DISABLED) {
      log.info("sidecar disabled via A2R_SIDECAR_DISABLED")
      return result
    }

    // Remote sidecar: skip local Ollama startup, probe the remote endpoint directly.
    if (REMOTE_SIDECAR_URL) {
      try {
        const resp = await fetch(`${REMOTE_SIDECAR_URL}/api/tags`, { signal: AbortSignal.timeout(4000) })
        if (resp.ok) {
          result.available = true
          log.info("remote sidecar connected", { url: REMOTE_SIDECAR_URL })
        } else {
          log.warn("remote sidecar responded with error", { status: resp.status, url: REMOTE_SIDECAR_URL })
        }
      } catch (err) {
        log.warn("remote sidecar unreachable", { url: REMOTE_SIDECAR_URL, error: err })
      }
      return result
    }

    // Check if already running (could be a shared Ollama instance or previous sidecar)
    if (await isRunning()) {
      // Check if our model is available
      if (await isModelPulled()) {
        result.available = true
        log.info("sidecar already running with model")
        return result
      }
    }

    // Find Ollama binary
    const ollamaBin = await findOllama()
    if (!ollamaBin) {
      log.warn("ollama not found — sidecar disabled. Install ollama to enable embedded model.")
      return result
    }

    // Start server if not running
    if (!(await isRunning())) {
      const started = await startServer(ollamaBin)
      if (!started) return result
    }

    // Pull model if not present
    if (!(await isModelPulled())) {
      const pulled = await pullModel(ollamaBin)
      if (!pulled) return result
    }

    result.available = true
    return result
  }

  /**
   * Get the provider config to inject into gizzi-code's provider system.
   * Returns null if sidecar is not available.
   */
  export function providerConfig(): {
    providerID: string
    npm: string
    options: Record<string, unknown>
    models: Record<string, unknown>
  } | null {
    return {
      providerID: "sidecar",
      npm: "@ai-sdk/openai-compatible",
      options: {
        baseURL: BaseURL,
      },
      models: {
        [EMBEDDED_MODEL.id]: {
          id: EMBEDDED_MODEL.ollamaTag,
          name: EMBEDDED_MODEL.name,
          tool_call: true,
          limit: {
            context: EMBEDDED_MODEL.contextLength,
            output: EMBEDDED_MODEL.outputLimit,
          },
        },
      },
    }
  }

  /**
   * Get the small_model identifier for config injection
   */
  export function smallModelID(): string {
    return `sidecar/${EMBEDDED_MODEL.id}`
  }
}
