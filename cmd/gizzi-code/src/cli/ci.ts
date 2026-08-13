// @ts-nocheck
/**
 * Gizzi Code CI Mode
 *
 * When --ci flag is set (or CI env vars are detected), the CLI enters
 * non-interactive mode with:
 *   - Structured NDJSON output on stdout
 *   - Deterministic exit codes
 *   - No TUI, no prompts, no interactive features
 *   - Auto-accept edits (acceptEdits permission mode)
 *   - Suppressed animations and progress indicators
 *
 * Exit codes:
 *   0 — success
 *   1 — runtime error
 *   2 — permission denied
 *   3 — config error
 *   4 — provider error (rate limit, auth, etc.)
 *   5 — timeout
 */

import { Log } from "@/shared/util/log"

const log = Log.create({ service: "ci" })

export namespace CIMode {
  export const ExitCode = {
    SUCCESS: 0,
    RUNTIME_ERROR: 1,
    PERMISSION_DENIED: 2,
    CONFIG_ERROR: 3,
    PROVIDER_ERROR: 4,
    TIMEOUT: 5,
  } as const

  export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode]

  let _active = false
  let _verbose = false
  let _outputFormat: "ndjson" | "text" | "markdown" = "text"

  /**
   * Detect whether the current environment is CI.
   */
  export function isCIEnvironment(): boolean {
    return (
      process.env.CI === "true" ||
      process.env.CI === "1" ||
      !!process.env.GITHUB_ACTIONS ||
      !!process.env.GITLAB_CI ||
      !!process.env.BUILDKITE ||
      !!process.env.CIRCLECI ||
      !!process.env.JENKINS_URL ||
      !!process.env.TF_BUILD ||
      !!process.env.DRONE ||
      !!process.env.TRAVIS
    )
  }

  /**
   * Activate CI mode with options.
   */
  export function activate(opts?: { verbose?: boolean; format?: "ndjson" | "text" | "markdown" }): void {
    _active = true
    _verbose = opts?.verbose ?? false
    _outputFormat = opts?.format ?? "ndjson"

    // Set environment variables for downstream systems
    process.env.GIZZI_CI = "1"
    process.env.GIZZI_PERMISSION_MODE = process.env.GIZZI_PERMISSION_MODE || "acceptEdits"

    log.info("CI mode activated", {
      format: _outputFormat,
      verbose: _verbose,
      permissionMode: process.env.GIZZI_PERMISSION_MODE,
    })
  }

  /**
   * Check if CI mode is active.
   */
  export function isActive(): boolean {
    return _active
  }

  /**
   * Check if verbose output is enabled.
   */
  export function isVerbose(): boolean {
    return _verbose
  }

  /**
   * Get the current output format.
   */
  export function getOutputFormat(): "ndjson" | "text" | "markdown" {
    return _outputFormat
  }

  /**
   * Write a structured CI output event to stdout.
   */
  export function emit(event: CIEvent): void {
    if (!_active) return

    const line = JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
    })

    if (_outputFormat === "ndjson") {
      process.stdout.write(line + "\n")
    } else if (_outputFormat === "text") {
      const prefix = event.severity === "error" ? "✗" : event.severity === "warn" ? "⚠" : "✓"
      process.stdout.write(`${prefix} [${event.type}] ${event.message}\n`)
    } else if (_outputFormat === "markdown") {
      process.stdout.write(`**[${event.type}]** ${event.message}\n`)
    }
  }

  /**
   * Write a progress event.
   */
  export function progress(phase: string, detail?: string): void {
    if (!_verbose) return
    emit({
      type: "progress",
      severity: "info",
      message: detail ? `${phase}: ${detail}` : phase,
    })
  }

  /**
   * Write a result event and exit with the appropriate code.
   */
  export function exitWithResult(success: boolean, message: string, data?: Record<string, unknown>): never {
    emit({
      type: "result",
      severity: success ? "info" : "error",
      message,
      data,
    })

    process.exit(success ? ExitCode.SUCCESS : ExitCode.RUNTIME_ERROR)
  }

  /**
   * Exit with a specific error code.
   */
  export function exitWithError(message: string, code: ExitCode, data?: Record<string, unknown>): never {
    emit({
      type: "error",
      severity: "error",
      message,
      data: { ...data, exitCode: code },
    })

    process.exit(code)
  }

  export interface CIEvent {
    type: string
    severity: "info" | "warn" | "error"
    message: string
    data?: Record<string, unknown>
    timestamp?: string
  }
}
