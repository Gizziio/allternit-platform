/**
 * Platform Daemon Management
 * 
 * Handles starting, stopping, and monitoring all platform services.
 * Ported from Rust CLI (7-apps/cli/src/commands/daemon.rs)
 */

import { spawn } from "child_process"
import { mkdir, writeFile, readFile, access } from "fs/promises"
import path from "path"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "platform-daemon" })

// Definitive Port Assignments
export const PLATFORM_PORTS = {
  PUBLIC_API: 3000,
  KERNEL: 3004,
  GATEWAY_SERVICE: 8013,
} as const

export interface DaemonStatus {
  running: boolean
  services: ServiceStatus[]
}

export interface ServiceStatus {
  name: string
  port: number
  status: "running" | "stopped"
  url: string
}

/**
 * Get the project root directory
 */
function getProjectRoot(): string {
  if (process.env.GIZZI_PROJECT_ROOT) {
    return process.env.GIZZI_PROJECT_ROOT
  }
  return process.cwd()
}

/**
 * Check if a service is running on a port
 */
export async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const cmd = `lsof -i:${port} 2>/dev/null | grep LISTEN || true`
    const child = spawn("sh", ["-c", cmd], { stdio: ["ignore", "pipe", "ignore"] })
    
    let output = ""
    child.stdout?.on("data", (data) => output += data.toString())
    child.on("close", () => resolve(output.length > 0))
    child.on("error", () => resolve(false))
    setTimeout(() => { try { child.kill() } catch {} resolve(false) }, 2000)
  })
}

/**
 * Start the platform orchestrator
 */
export async function startPlatform(): Promise<{ success: boolean; error?: string }> {
  const projectRoot = getProjectRoot()
  log.info("Starting platform...", { projectRoot })
  
  return new Promise((resolve) => {
    const child = spawn("cargo", ["run", "-p", "gizzichitech-platform"], {
      cwd: projectRoot,
      detached: true,
      stdio: "ignore",
    })
    
    if (child.pid) {
      child.unref()
      setTimeout(() => resolve({ success: true }), 2000)
    } else {
      resolve({ success: false, error: "Failed to spawn" })
    }
  })
}

/**
 * Stop the platform
 */
export async function stopPlatform(): Promise<{ success: boolean }> {
  // Kill processes on key ports
  const ports = Object.values(PLATFORM_PORTS)
  for (const port of ports) {
    spawn("sh", ["-c", `lsof -ti:${port} | xargs kill -9 2>/dev/null || true`], { stdio: "ignore" })
  }
  
  await new Promise(r => setTimeout(r, 1500))
  return { success: true }
}

/**
 * Get platform status
 */
export async function getPlatformStatus(): Promise<DaemonStatus> {
  const services: ServiceStatus[] = [
    { name: "API", port: PLATFORM_PORTS.PUBLIC_API, status: "stopped", url: "http://localhost:3000" },
    { name: "Kernel", port: PLATFORM_PORTS.KERNEL, status: "stopped", url: "http://localhost:3004" },
  ]
  
  for (const svc of services) {
    svc.status = await checkPort(svc.port) ? "running" : "stopped"
  }
  
  return {
    running: services.some(s => s.status === "running"),
    services,
  }
}

/**
 * Run platform doctor
 */
export async function runDoctor(): Promise<{
  healthy: boolean
  checks: Array<{ name: string; status: "ok" | "warn" | "error"; message: string }>
}> {
  const checks: Array<{ name: string; status: "ok" | "warn" | "error"; message: string }> = []
  
  // Check cargo
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("cargo", ["--version"], { stdio: "ignore" })
      child.on("close", (code) => code === 0 ? resolve() : reject())
      setTimeout(() => reject(), 5000)
    })
    checks.push({ name: "Cargo", status: "ok", message: "Available" })
  } catch {
    checks.push({ name: "Cargo", status: "error", message: "Not found" })
  }
  
  // Check bun
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("bun", ["--version"], { stdio: "ignore" })
      child.on("close", (code) => code === 0 ? resolve() : reject())
      setTimeout(() => reject(), 5000)
    })
    checks.push({ name: "Bun", status: "ok", message: "Available" })
  } catch {
    checks.push({ name: "Bun", status: "error", message: "Not found" })
  }
  
  const status = await getPlatformStatus()
  checks.push({ 
    name: "Platform", 
    status: status.running ? "ok" : "warn", 
    message: status.running ? "Running" : "Stopped" 
  })
  
  return { healthy: checks.every(c => c.status !== "error"), checks }
}
