import { spawn, execFile } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { Log } from "@/shared/util/log"
import { VM_NAME } from "./lima-executor"

const log = Log.create({ service: "lima-setup" })

const __dirname = dirname(fileURLToPath(import.meta.url))
export const LIMA_YAML_PATH = join(__dirname, "allternit.yaml")

export async function isLimaInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("limactl", ["--version"], { timeout: 3000 }, (err) => resolve(!err))
  })
}

export async function installLima(): Promise<void> {
  log.info("Installing Lima via brew...")
  return new Promise((resolve, reject) => {
    const proc = spawn("brew", ["install", "lima"], { stdio: "pipe" })
    proc.on("close", (code) => {
      if (code === 0) {
        log.info("Lima installed successfully")
        resolve()
      } else {
        reject(new Error(`brew install lima failed (exit ${code})`))
      }
    })
    proc.on("error", reject)
  })
}

export async function vmExists(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("limactl", ["list", VM_NAME, "--format", "json"], { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout.trim()) { resolve(false); return }
      try {
        const rows = JSON.parse(stdout) as Array<{ name: string }>
        resolve(Array.isArray(rows) && rows.some(v => v.name === VM_NAME))
      } catch {
        resolve(false)
      }
    })
  })
}

export async function startVM(
  yamlPath: string = LIMA_YAML_PATH,
  onProgress?: (stage: string, message: string, progress: number) => void
): Promise<void> {
  const exists = await vmExists()
  const args = exists
    ? ["start", VM_NAME]
    : ["start", "--name", VM_NAME, yamlPath]

  log.info(`Starting Lima VM (${exists ? "existing" : "new"})...`)
  onProgress?.("booting", "Starting Linux VM...", 30)

  return new Promise((resolve, reject) => {
    const proc = spawn("limactl", args, { stdio: "pipe" })
    let stderr = ""
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString() })
    proc.on("close", (code) => {
      if (code === 0) {
        onProgress?.("ready", "VM Ready!", 100)
        log.info("Lima VM started")
        resolve()
      } else {
        reject(new Error(`limactl start failed (exit ${code}): ${stderr.slice(-500)}`))
      }
    })
    proc.on("error", reject)
  })
}

export async function stopVM(): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("limactl", ["stop", VM_NAME], { timeout: 30_000 }, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}
