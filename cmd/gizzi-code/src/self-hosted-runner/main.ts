/**
 * Self-Hosted Runner — Entry Point
 *
 * An HTTP-based agent runner that registers with the Allternit API, polls for
 * pending jobs, executes them in isolated gizzi-code CLI sessions, and streams
 * results back. Analogous to a CI/CD self-hosted runner but for AI agent tasks.
 *
 * Usage:
 *   gizzi runner --token <token> [--name <name>] [--api-url <url>] [--config <file>]
 */

import { mkdirSync } from 'node:fs'
import type { Server } from 'node:http'
import type { RunnerConfig, RunnerStatus, AgentJob, JobResult } from './types.js'
import { resolveConfig, validateConfig, type ConfigOverrides } from './config.js'
import { registerRunner, pollForJob, reportJobResult, sendHeartbeat } from './auth.js'
import { JobExecutor } from './job-executor.js'
import { createHealthServer } from './server.js'

/** Parse CLI arguments into a ConfigOverrides object. */
function parseArgs(argv: string[]): ConfigOverrides {
  const overrides: ConfigOverrides = {}

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = (): string => {
      const val = argv[++i]
      if (val === undefined) throw new Error(`missing value for ${arg}`)
      return val
    }

    switch (arg) {
      case '--config':
      case '-c':
        overrides.configFile = next()
        break
      case '--token':
        overrides.runnerToken = next()
        break
      case '--name':
        overrides.runnerName = next()
        break
      case '--api-url':
        overrides.apiUrl = next()
        break
      case '--max-jobs':
        overrides.maxConcurrentJobs = parseInt(next(), 10)
        break
      case '--work-dir':
        overrides.workDir = next()
        break
      case '--labels':
        overrides.labels = next().split(',').map((l) => l.trim()).filter(Boolean)
        break
      case '--port':
        overrides.healthPort = parseInt(next(), 10)
        break
      case '--poll-interval':
        overrides.pollIntervalMs = parseInt(next(), 10)
        break
      case '--help':
      case '-h':
        printUsage()
        process.exit(0)
        break
      default:
        if (arg.startsWith('-')) {
          console.error(`[main] unknown option: ${arg}`)
          printUsage()
          process.exit(1)
        }
        break
    }
  }

  return overrides
}

function printUsage(): void {
  console.log(`
Gizzi Code Self-Hosted Runner

Usage: gizzi runner [options]

Options:
  --token,          Runner authentication token (or GIZZI_RUNNER_TOKEN)
  --name,           Runner name (or GIZZI_RUNNER_NAME)
  --api-url,        Allternit API URL (or ALLTERNIT_API_URL)
  --config, -c      Path to JSON config file
  --max-jobs        Max concurrent jobs (default: 2)
  --work-dir        Working directory for job execution
  --labels          Comma-separated labels for job matching
  --port            Health server port (default: 3090)
  --poll-interval   Job poll interval in ms (default: 5000)
  --help, -h        Show this help

Environment variables:
  ALLTERNIT_API_URL           API base URL
  GIZZI_RUNNER_TOKEN          Authentication token
  GIZZI_RUNNER_NAME           Runner name
  GIZZI_RUNNER_LABELS         Comma-separated labels
  GIZZI_RUNNER_MAX_JOBS       Max concurrent jobs
  GIZZI_RUNNER_WORK_DIR       Working directory
  GIZZI_RUNNER_POLL_INTERVAL  Poll interval (ms)
  GIZZI_RUNNER_HEALTH_PORT    Health server port
`.trim())
}

/** The main Runner orchestrator. */
class Runner {
  private config: RunnerConfig
  private executor: JobExecutor
  private server: Server | null = null
  private status: RunnerStatus = 'idle'
  private startedAt = Date.now()
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private shutdownRequested = false

  constructor(config: RunnerConfig) {
    this.config = config
    this.executor = new JobExecutor()
  }

  /** Register with the API and start the health server + polling loop. */
  async start(): Promise<void> {
    console.log(`[runner] starting "${this.config.runnerName}"`)
    console.log(`[runner] API: ${this.config.apiUrl}`)
    console.log(`[runner] max concurrent jobs: ${this.config.maxConcurrentJobs}`)
    console.log(`[runner] labels: ${this.config.labels.join(', ') || '(none)'}`)

    // Ensure work directory exists.
    mkdirSync(this.config.workDir, { recursive: true })

    // Register with the Allternit API.
    try {
      const reg = await registerRunner(this.config)
      console.log(`[runner] registered as ${reg.runnerId}`)
      if (reg.token) {
        this.config.runnerToken = reg.token
        console.log('[runner] received refreshed token from API')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[runner] registration failed: ${msg}`)
      console.warn('[runner] continuing in offline mode — will retry on first poll')
    }

    // Start health HTTP server.
    this.server = createHealthServer({
      port: this.config.healthPort,
      runnerName: this.config.runnerName,
      labels: this.config.labels,
      maxConcurrentJobs: this.config.maxConcurrentJobs,
      startedAt: this.startedAt,
      getStatus: () => this.status,
      executor: this.executor,
    })

    // Start heartbeat.
    this.heartbeatTimer = setInterval(() => {
      sendHeartbeat(this.config)
    }, 30_000)
    // Fire an immediate heartbeat.
    sendHeartbeat(this.config)

    // Start the poll loop.
    this.schedulePoll()

    console.log('[runner] ready — polling for jobs')
  }

  /** Schedule the next poll tick. */
  private schedulePoll(): void {
    if (this.shutdownRequested) return
    this.pollTimer = setTimeout(() => {
      this.pollTick().catch((err) => {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[runner] poll error: ${msg}`)
      }).finally(() => {
        this.schedulePoll()
      })
    }, this.config.pollIntervalMs)
  }

  /** Single poll iteration: fetch a job and execute it if capacity allows. */
  private async pollTick(): Promise<void> {
    if (this.shutdownRequested) return

    // Check capacity.
    if (this.executor.runningCount >= this.config.maxConcurrentJobs) {
      this.status = 'busy'
      return
    }

    this.status = this.executor.runningCount > 0 ? 'busy' : 'idle'

    let job: AgentJob | null = null
    try {
      job = await pollForJob(this.config)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[runner] poll failed: ${msg}`)
      return
    }

    if (!job) return

    console.log(`[runner] received job ${job.id} (${job.type})`)
    this.status = 'busy'

    // Fire-and-forget execution; results are reported asynchronously.
    this.executeAndReport(job)
  }

  /** Execute a job and report the result back to the API. */
  private async executeAndReport(job: AgentJob): Promise<void> {
    let result: JobResult
    try {
      result = await this.executor.execute(job, this.config.workDir)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[runner] unhandled error executing job ${job.id}: ${msg}`)
      result = {
        jobId: job.id,
        status: 'failed',
        output: `Runner internal error: ${msg}`,
        exitCode: 1,
        durationMs: 0,
      }
    }

    try {
      await reportJobResult(this.config, result)
      console.log(`[runner] reported result for job ${job.id}: ${result.status}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[runner] failed to report result for job ${job.id}: ${msg}`)
    }
  }

  /** Graceful shutdown: stop accepting new jobs, wait for active ones, then exit. */
  async shutdown(): Promise<void> {
    if (this.shutdownRequested) return
    this.shutdownRequested = true
    this.status = 'draining'

    console.log('[runner] shutdown requested — draining active jobs')

    // Stop the poll loop.
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }

    // Stop heartbeats.
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    // Cancel all active jobs so they can finish quickly.
    if (this.executor.runningCount > 0) {
      console.log(`[runner] cancelling ${this.executor.runningCount} active job(s)`)
      this.executor.cancelAll()
      // Wait up to 15 seconds for graceful process exit.
      const deadline = Date.now() + 15_000
      while (this.executor.runningCount > 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 500))
      }
      if (this.executor.runningCount > 0) {
        console.warn(`[runner] ${this.executor.runningCount} job(s) still active after drain timeout`)
      }
    }

    // Close health server.
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve())
      })
      console.log('[runner] health server closed')
    }

    this.status = 'stopped'
    console.log('[runner] shutdown complete')
  }
}

/** Top-level entry point. */
export async function main(): Promise<void> {
  const cliOverrides = parseArgs(process.argv.slice(2))
  const config = resolveConfig(cliOverrides)

  const validationError = validateConfig(config)
  if (validationError) {
    console.error(`[main] configuration error: ${validationError}`)
    process.exit(1)
  }

  const runner = new Runner(config)

  // Handle graceful shutdown signals.
  let shuttingDown = false
  const handleSignal = (signal: string): void => {
    if (shuttingDown) {
      console.warn(`[main] received ${signal} again — forcing exit`)
      process.exit(1)
    }
    shuttingDown = true
    console.log(`[main] received ${signal} — initiating graceful shutdown`)
    runner.shutdown().then(() => process.exit(0)).catch((err) => {
      console.error(`[main] shutdown error: ${err}`)
      process.exit(1)
    })
  }

  process.on('SIGINT', () => handleSignal('SIGINT'))
  process.on('SIGTERM', () => handleSignal('SIGTERM'))

  try {
    await runner.start()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[main] fatal error: ${msg}`)
    process.exit(1)
  }
}
