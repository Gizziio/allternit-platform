/**
 * Fallback Session Strategy
 *
 * Implements a fallback mechanism that tries VM execution first,
 * then falls back to local execution if the VM is unavailable.
 *
 * @module @/cli/fallback
 */

import { VMSession, type Command, type Result, type Session } from "@/cli/sessions/vm"
import { DaemonNotRunningError, VMNotReadyError } from "@/cli/sessions/errors"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "fallback-session" })

/**
 * Local session interface - minimal interface for local execution
 */
interface LocalSession extends Session {
  execute(command: Command): Promise<Result>
}

/**
 * Options for fallback session
 */
export interface FallbackSessionOptions {
  /** Enable fallback to local execution (default: true) */
  readonly enableLocalFallback?: boolean
  /** Log fallback reasons (default: true) */
  readonly logFallback?: boolean
  /** Custom local session implementation */
  readonly localSession?: LocalSession
}

/**
 * Simple local session implementation using child_process
 */
class DefaultLocalSession implements LocalSession {
  /**
   * Execute command locally using Bun's spawn
   */
  async execute(command: Command): Promise<Result> {
    const { spawn } = await import("child_process")

    return new Promise((resolve, reject) => {
      const proc = spawn(command.command, {
        shell: true,
        cwd: command.cwd,
        env: { ...process.env, ...command.env },
        stdio: ["ignore", "pipe", "pipe"],
      })

      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []

      proc.stdout?.on("data", (chunk: Buffer) => stdoutChunks.push(chunk))
      proc.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk))

      const timeout = command.timeout ?? 120000 // 2 minute default
      const timeoutTimer = setTimeout(() => {
        proc.kill("SIGTERM")
      }, timeout)

      proc.on("exit", (exitCode) => {
        clearTimeout(timeoutTimer)
        resolve({
          exitCode: exitCode ?? 0,
          stdout: Buffer.concat(stdoutChunks),
          stderr: Buffer.concat(stderrChunks),
        })
      })

      proc.on("error", (error) => {
        clearTimeout(timeoutTimer)
        reject(error)
      })
    })
  }
}

/**
 * Fallback session that tries VM first, then local execution
 *
 * This session implementation provides seamless fallback from VM execution
 * to local execution when the desktop daemon is not available. This ensures
 * the CLI can continue operating even when the VM is not running.
 *
 * @example
 * ```typescript
 * const session = new FallbackSession()
 *
 * // Tries VM first, falls back to local if VM unavailable
 * const result = await session.execute({
 *   command: "npm install",
 *   cwd: "/project"
 * })
 * ```
 */
export class FallbackSession implements Session {
  private vmSession: VMSession
  private localSession: LocalSession
  private options: Required<Pick<FallbackSessionOptions, "enableLocalFallback" | "logFallback">>

  /**
   * Create a new fallback session
   *
   * @param options - Fallback options
   */
  constructor(options: FallbackSessionOptions = {}) {
    this.vmSession = new VMSession()
    this.localSession = options.localSession ?? new DefaultLocalSession()
    this.options = {
      enableLocalFallback: options.enableLocalFallback ?? true,
      logFallback: options.logFallback ?? true,
    }
  }

  /**
   * Execute a command with fallback support
   *
   * Attempts to execute via VM first. If VM is unavailable,
   * falls back to local execution (if enabled).
   *
   * @param command - Command to execute
   * @returns Execution result
   * @throws Error if both VM and local execution fail
   */
  async execute(command: Command): Promise<Result> {
    // Try VM session first
    try {
      const isRunning = await this.vmSession.isDaemonRunning()
      if (isRunning) {
        log.info("Executing via VM session", { command: command.command })
        return await this.vmSession.execute(command)
      }
    } catch (error) {
      if (error instanceof DaemonNotRunningError || error instanceof VMNotReadyError) {
        // Expected errors, will fallback
        this.logFallback("VM unavailable", error)
      } else {
        // Unexpected error from VM, still try fallback
        this.logFallback("VM execution failed", error)
      }
    }

    // Check if local fallback is enabled
    if (!this.options.enableLocalFallback) {
      throw new DaemonNotRunningError()
    }

    // Fall back to local execution
    log.info("Falling back to local execution", { command: command.command })
    try {
      return await this.localSession.execute(command)
    } catch (localError) {
      log.error("Local execution failed", {
        command: command.command,
        error: localError instanceof Error ? localError.message : String(localError),
      })
      throw localError
    }
  }

  /**
   * Execute a command with streaming output and fallback support
   *
   * @param command - Command to execute
   * @param handlers - Stream handlers
   */
  async executeStreaming(
    command: Command,
    handlers: {
      onStdout: (data: Buffer) => void
      onStderr: (data: Buffer) => void
      onExit: (code: number) => void
    }
  ): Promise<void> {
    // Try VM session first
    try {
      const isRunning = await this.vmSession.isDaemonRunning()
      if (isRunning) {
        log.info("Executing streaming via VM session", { command: command.command })
        await this.vmSession.executeStreaming(command, handlers)
        return
      }
    } catch (error) {
      if (error instanceof DaemonNotRunningError || error instanceof VMNotReadyError) {
        this.logFallback("VM unavailable for streaming", error)
      } else {
        this.logFallback("VM streaming execution failed", error)
      }
    }

    if (!this.options.enableLocalFallback) {
      throw new DaemonNotRunningError()
    }

    // Fall back to local execution
    log.info("Falling back to local streaming execution", { command: command.command })

    const { spawn } = await import("child_process")

    return new Promise((resolve, reject) => {
      const proc = spawn(command.command, {
        shell: true,
        cwd: command.cwd,
        env: { ...process.env, ...command.env },
        stdio: ["ignore", "pipe", "pipe"],
      })

      proc.stdout?.on("data", handlers.onStdout)
      proc.stderr?.on("data", handlers.onStderr)

      const timeout = command.timeout ?? 120000
      const timeoutTimer = setTimeout(() => {
        proc.kill("SIGTERM")
      }, timeout)

      proc.on("exit", (code) => {
        clearTimeout(timeoutTimer)
        handlers.onExit(code ?? 0)
        resolve()
      })

      proc.on("error", (error) => {
        clearTimeout(timeoutTimer)
        reject(error)
      })
    })
  }

  /**
   * Check if VM session is available
   *
   * @returns True if VM daemon is running
   */
  async isVMAvailable(): Promise<boolean> {
    return this.vmSession.isDaemonRunning()
  }

  /**
   * Get VM status
   *
   * @returns VM status or undefined if daemon not running
   */
  async getVMStatus(): Promise<"running" | "starting" | "stopped" | undefined> {
    return this.vmSession.getVMStatus()
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    await this.vmSession.dispose()
  }

  /**
   * Log fallback reason if logging is enabled
   */
  private logFallback(reason: string, error: unknown): void {
    if (!this.options.logFallback) return

    const message = error instanceof Error ? error.message : String(error)
    log.warn(`${reason}, falling back to local execution: ${message}`)

    // Also output to stderr for user visibility
    console.warn(`VM unavailable, falling back to local: ${message}`)
  }
}

/**
 * Create a fallback session with default options
 *
 * @param options - Optional fallback configuration
 * @returns Configured fallback session
 */
export function createFallbackSession(options?: FallbackSessionOptions): FallbackSession {
  return new FallbackSession(options)
}
