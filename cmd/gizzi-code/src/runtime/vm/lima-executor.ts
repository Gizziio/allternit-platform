import { spawn, execFile } from "node:child_process"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "lima-executor" })

export const VM_NAME = "allternit"

export interface ExecuteResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface ExecuteOptions {
  workingDir?: string
  env?: Record<string, string>
  timeout?: number
}

export type VMStatus = "running" | "stopped" | "error" | "not-installed"

export async function executeInVM(
  command: string,
  args: string[] = [],
  options: ExecuteOptions = {}
): Promise<ExecuteResult> {
  const { workingDir, env, timeout = 60_000 } = options

  const shellCmd = workingDir
    ? `cd ${JSON.stringify(workingDir)} && ${[command, ...args].map(a => JSON.stringify(a)).join(" ")}`
    : [command, ...args].join(" ")

  return new Promise((resolve, reject) => {
    const proc = spawn("limactl", ["shell", VM_NAME, "--", "sh", "-c", shellCmd], {
      env: { ...process.env, ...env },
    })

    let stdout = ""
    let stderr = ""
    let done = false

    const timer = setTimeout(() => {
      if (!done) {
        done = true
        proc.kill()
        reject(new Error(`VM command timed out after ${timeout}ms: ${command}`))
      }
    }, timeout)

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString() })
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString() })

    proc.on("close", (code) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode: code ?? 0 })
    })

    proc.on("error", (err) => {
      if (done) return
      done = true
      clearTimeout(timer)
      reject(err)
    })
  })
}

export async function getVMStatus(): Promise<VMStatus> {
  return new Promise((resolve) => {
    execFile("limactl", ["--version"], { timeout: 3000 }, (err) => {
      if (err) {
        // Lima not installed
        resolve("not-installed")
        return
      }
      execFile("limactl", ["list", VM_NAME, "--format", "json"], { timeout: 5000 }, (listErr, stdout) => {
        if (listErr || !stdout.trim()) {
          resolve("stopped")
          return
        }
        try {
          const rows = JSON.parse(stdout) as Array<{ name: string; status: string }>
          const vm = Array.isArray(rows)
            ? rows.find(v => v.name === VM_NAME)
            : null
          if (!vm) { resolve("stopped"); return }
          if (vm.status === "Running") { resolve("running"); return }
          if (vm.status === "Stopped") { resolve("stopped"); return }
          resolve("error")
        } catch {
          resolve("error")
        }
      })
    })
  })
}
