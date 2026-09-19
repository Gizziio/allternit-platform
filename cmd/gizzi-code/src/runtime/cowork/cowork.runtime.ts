/**
 * Cowork Runtime Execution Engine
 *
 * Executes runs in local, remote, or cloud modes.
 * VM-mode runs are not executed in-process: the vfkit manager was removed in
 * the 2026-09 dead-code cleanup (Lima replaced it). The cron CoworkExecutor
 * remains the supported VM-backed execution path.
 */

import { Log } from "@/shared/util/log"
import { RunService } from "@/runtime/cowork/cowork.service"
import type { Run, RunConfig, RunStatus } from "@/runtime/cowork/cowork.service"
import { spawn } from "child_process"

const log = Log.create({ service: "cowork-runtime" })

// RunConfig in cowork.service.ts omits timeout_ms/runtime, but runs carry
// both at runtime.
type RuntimeRunConfig = Omit<RunConfig, "runtime"> & {
  timeout_ms?: number
  runtime?: string
}

export namespace CoworkRuntime {
  export async function execute(run: Run): Promise<void> {
    RunService.updateStatus(run.id, "running", { started_at: Date.now() } as any)
    RunService.appendEvent(run.id, "run_started", { run_id: run.id, name: run.name })

    try {
      // RunConfig in cowork.service.ts omits timeout_ms/runtime, but runs
      // carry both at runtime.
      const config = (run.config ?? {}) as RuntimeRunConfig
      const command = config.command

      if (!command) {
        finishRun(run.id, "completed", { completed_steps: 1, total_steps: 1 })
        return
      }

      switch (run.mode) {
        case "local":
          await executeLocal(run, config)
          break
        case "vm":
          throw new Error(
            'mode "vm" is not supported by the in-process cowork runtime (the vfkit manager was removed in the 2026-09 cleanup); use the cron CoworkExecutor for VM-backed runs',
          )
        case "remote":
          await executeRemote(run, config)
          break
        case "cloud":
          await executeCloud(run, config)
          break
        default:
          throw new Error(`Unknown mode: ${run.mode}`)
      }
    } catch (err: any) {
      log.error("run execution failed", { run_id: run.id, error: err.message })
      finishRun(run.id, "failed", { error_message: err.message })
    }
  }

  async function executeLocal(run: Run, config: RuntimeRunConfig): Promise<void> {
    const steps = ["prepare", "execute", "finalize"]
    RunService.updateStatus(run.id, "running", { total_steps: steps.length })

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      RunService.updateStatus(run.id, "running", { step_cursor: step, completed_steps: i })
      RunService.appendEvent(run.id, "step_started", { step_name: step, step_index: i })

      if (step === "execute" && config.command) {
        const useSandbox = config.runtime === "sandbox" || process.env.GIZZI_SANDBOX === "1"
        const output = await runCommand(config.command, {
          cwd: config.working_dir,
          env: config.env,
          timeout: config.timeout_ms ?? 300000,
          sandbox: useSandbox,
          sandboxDir: config.working_dir ?? process.cwd(),
        })

        if (output.stdout) {
          RunService.appendEvent(run.id, "stdout", { content: output.stdout, step })
        }
        if (output.stderr) {
          RunService.appendEvent(run.id, "stderr", { content: output.stderr, step })
        }
        if (output.exitCode !== 0) {
          throw new Error(`Command exited with code ${output.exitCode}: ${output.stderr}`)
        }
      } else {
        await sleep(200)
      }

      RunService.updateStatus(run.id, "running", { completed_steps: i + 1 })
      RunService.appendEvent(run.id, "step_completed", { step_name: step, step_index: i })
    }

    finishRun(run.id, "completed")
  }

  async function executeRemote(run: Run, config: RuntimeRunConfig): Promise<void> {
    RunService.appendEvent(run.id, "stdout", {
      content: `[remote] Would execute on ${config.host}:${config.port || 22}\n`,
    })
    await sleep(500)
    finishRun(run.id, "completed")
  }

  async function executeCloud(run: Run, config: RuntimeRunConfig): Promise<void> {
    RunService.appendEvent(run.id, "stdout", {
      content: `[cloud] Would deploy to ${config.provider || "hetzner"} / ${config.region || "nbg1"}\n`,
    })
    await sleep(500)
    finishRun(run.id, "completed")
  }

  function finishRun(
    runId: string,
    status: RunStatus,
    opts?: { completed_steps?: number; total_steps?: number; error_message?: string },
  ) {
    RunService.updateStatus(runId, status, opts)
    if (status === "completed") {
      RunService.appendEvent(runId, "run_completed", { run_id: runId })
    } else if (status === "failed") {
      RunService.appendEvent(runId, "run_failed", { run_id: runId, error: opts?.error_message })
    }
  }

  export async function triggerSchedule(scheduleId: string): Promise<Run> {
    const { ScheduleService } = await import("@/runtime/cowork/cowork.service")
    const schedule = ScheduleService.get(scheduleId)
    if (!schedule) throw new Error("Schedule not found")

    const run = RunService.create({
      name: `${schedule.name} (scheduled)`,
      mode: schedule.mode,
      config: (schedule.job_template ?? {}) as RunConfig,
      auto_start: true,
    })

    ScheduleService.incrementRunCount(scheduleId)
    setTimeout(() => execute(run), 0)
    return run
  }
}

// ============================================================================
// Helpers
// ============================================================================

interface CommandOutput {
  stdout: string
  stderr: string
  exitCode: number
}

function runCommand(
  command: string,
  opts: { cwd?: string; env?: Record<string, string>; timeout?: number; sandbox?: boolean; sandboxDir?: string },
): Promise<CommandOutput> {
  return new Promise((resolve, reject) => {
    let shellCmd = command

    // Wrap with bubblewrap if requested and available (Linux only)
    if (opts.sandbox && process.platform === "linux") {
      const dir = opts.sandboxDir ?? opts.cwd ?? process.cwd()
      shellCmd = `bwrap --die-with-parent --unshare-all --share-net --tmpfs /tmp --bind "${dir}" "${dir}" --chdir "${dir}" -- /bin/sh -c ${JSON.stringify(command)}`
    }

    const child = spawn(shellCmd, [], {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout?.on("data", (data) => { stdout += data })
    child.stderr?.on("data", (data) => { stderr += data })

    const timeout = setTimeout(() => {
      child.kill("SIGTERM")
      reject(new Error(`Command timed out after ${opts.timeout ?? 300000}ms`))
    }, opts.timeout ?? 300000)

    child.on("close", (code) => {
      clearTimeout(timeout)
      resolve({ stdout, stderr, exitCode: code ?? 0 })
    })

    child.on("error", (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
