/**
 * Job execution engine.
 *
 * Spawns a child process running the gizzi-code CLI with the job's prompt,
 * captures stdout/stderr, enforces timeouts, and supports cancellation.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { resolve as resolvePath } from 'node:path'
import { mkdirSync } from 'node:fs'
import type { AgentJob, JobResult, JobState } from './types.js'

/** Default job timeout: 10 minutes. */
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1_000

/** Maximum captured output size to prevent unbounded memory growth. */
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024 // 4 MiB

/**
 * Resolve the path to the gizzi-code CLI binary.
 * In production this is the compiled dist binary; in development we fall back
 * to running via bun/tsx.
 */
function resolveCliPath(): { command: string; args: string[] } {
  // If running from a built dist, process.argv[0] is the binary itself.
  // Check for a GIZZI_CLI_PATH override first (useful in tests / dev).
  const override = process.env.GIZZI_CLI_PATH
  if (override) return { command: override, args: [] }

  // When running via bun, use `bun run` pointed at the CLI entry.
  // When running as a compiled binary, reuse the same binary.
  const execPath = process.execPath
  if (execPath.endsWith('bun') || execPath.endsWith('bun.exe')) {
    return {
      command: execPath,
      args: ['run', resolvePath(__dirname, '../../cli/main.ts')],
    }
  }

  // Compiled binary — invoke itself with the `run` subcommand.
  return { command: execPath, args: [] }
}

export class JobExecutor {
  private active = new Map<string, JobState & { process: ChildProcess }>()

  /** Number of jobs currently executing. */
  get runningCount(): number {
    return this.active.size
  }

  /** Snapshot of all active job states (for the /jobs endpoint). */
  getActiveJobs(): Array<{ id: string; type: string; startedAt: number; pid: number | null }> {
    return [...this.active.entries()].map(([id, state]) => ({
      id,
      type: state.job.type,
      startedAt: state.startedAt,
      pid: state.pid,
    }))
  }

  /**
   * Execute a job and return the result.
   * The job runs the gizzi-code CLI in headless `run` mode with the job prompt.
   */
  async execute(job: AgentJob, workDir: string): Promise<JobResult> {
    const startedAt = Date.now()
    const timeoutMs = job.timeout ?? DEFAULT_TIMEOUT_MS
    const cwd = job.workingDirectory
      ? resolvePath(job.workingDirectory)
      : resolvePath(workDir, job.id)

    // Ensure working directory exists.
    mkdirSync(cwd, { recursive: true })

    const { command, args: baseArgs } = resolveCliPath()
    const cliArgs = [...baseArgs, 'run', '--print', job.prompt]

    const env = {
      ...process.env,
      ...job.environment,
      // Ensure non-interactive output for capture.
      NO_COLOR: '1',
      CI: '1',
    }

    console.log(`[executor] starting job ${job.id} (${job.type}) in ${cwd}`)
    console.log(`[executor] command: ${command} ${cliArgs.join(' ')}`)

    const child = spawn(command, cliArgs, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const state: JobState & { process: ChildProcess } = {
      job,
      startedAt,
      pid: child.pid ?? null,
      cancelled: false,
      process: child,
    }
    this.active.set(job.id, state)

    // Collect output.
    let output = ''
    const appendOutput = (chunk: Buffer): void => {
      if (output.length < MAX_OUTPUT_BYTES) {
        output += chunk.toString('utf-8')
        if (output.length > MAX_OUTPUT_BYTES) {
          output = output.slice(0, MAX_OUTPUT_BYTES) + '\n... [output truncated]'
        }
      }
    }

    child.stdout?.on('data', appendOutput)
    child.stderr?.on('data', appendOutput)

    // Enforce timeout.
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      console.warn(`[executor] job ${job.id} timed out after ${timeoutMs}ms — killing pid ${child.pid}`)
      child.kill('SIGTERM')
      // Escalate to SIGKILL if the process doesn't exit in 5 seconds.
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL')
      }, 5_000)
    }, timeoutMs)

    // Wait for the process to exit.
    const exitCode = await new Promise<number>((resolve) => {
      child.on('close', (code) => {
        resolve(code ?? 1)
      })
      child.on('error', (err) => {
        console.error(`[executor] job ${job.id} spawn error: ${err.message}`)
        output += `\n[spawn error] ${err.message}\n`
        resolve(1)
      })
    })

    clearTimeout(timer)
    this.active.delete(job.id)

    const durationMs = Date.now() - startedAt

    let status: JobResult['status']
    if (state.cancelled) {
      status = 'cancelled'
    } else if (timedOut) {
      status = 'timeout'
    } else if (exitCode === 0) {
      status = 'completed'
    } else {
      status = 'failed'
    }

    console.log(`[executor] job ${job.id} finished: ${status} (exit ${exitCode}, ${durationMs}ms)`)

    return { jobId: job.id, status, output, exitCode, durationMs }
  }

  /**
   * Cancel a running job by ID.
   * Returns true if the job was found and a kill signal was sent.
   */
  cancel(jobId: string): boolean {
    const state = this.active.get(jobId)
    if (!state) return false

    state.cancelled = true
    console.log(`[executor] cancelling job ${jobId} (pid ${state.pid})`)

    try {
      if (state.pid != null) {
        // Send SIGTERM first for graceful shutdown.
        process.kill(state.pid, 'SIGTERM')
        // Escalate to SIGKILL after 5 seconds if still alive.
        setTimeout(() => {
          try {
            process.kill(state.pid!, 'SIGKILL')
          } catch {
            // Process already exited — ignore.
          }
        }, 5_000)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[executor] failed to kill job ${jobId}: ${msg}`)
    }

    return true
  }

  /** Cancel all active jobs (used during shutdown). */
  cancelAll(): void {
    for (const jobId of this.active.keys()) {
      this.cancel(jobId)
    }
  }
}
