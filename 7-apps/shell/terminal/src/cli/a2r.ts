#!/usr/bin/env bun
/**
 * A2R Unified CLI
 * 
 * Single entry point for:
 * - Platform lifecycle (up/down/status/doctor/logs)
 * - TUI launcher (tui)
 * 
 * Replaces: 7-apps/cli (Rust) + bin/a2r wrapper
 */

import { startPlatform, stopPlatform, getPlatformStatus, runDoctor } from "./platform/daemon"

const VERSION = "0.1.0"

function printHelp() {
  console.log(`
A2R - A2rchitect Platform Command ${VERSION}

Usage: a2r [command]

Commands:
  tui         Launch Terminal UI (chat interface)
  up          Start platform services
  down        Stop platform services  
  status      Show platform status
  doctor      Run diagnostics
  logs        Show platform logs
  help        Show this help

Examples:
  a2r tui              # Launch chat interface
  a2r up               # Start platform
  a2r status           # Check if running
  a2r doctor           # Diagnose issues
`)
}

export async function main() {
  const command = process.argv[2]
  
  switch (command) {
    case "tui":
    case undefined:
    case "":
      // Launch TUI - this is the default
      console.log("Launching A2R Terminal UI...")
      // Import and start TUI
      await import("../index")
      break
      
    case "up":
      console.log("Starting A2R platform...")
      const start = await startPlatform()
      if (start.success) {
        console.log("✓ Platform starting (check status in a few seconds)")
      } else {
        console.error("✗ Failed to start:", start.error)
        process.exit(1)
      }
      break
      
    case "down":
      console.log("Stopping A2R platform...")
      await stopPlatform()
      console.log("✓ Platform stopped")
      break
      
    case "status":
      const status = await getPlatformStatus()
      console.log(status.running ? "Platform: RUNNING" : "Platform: STOPPED")
      console.log("")
      console.log("Services:")
      for (const svc of status.services) {
        const icon = svc.status === "running" ? "●" : "○"
        const color = svc.status === "running" ? "\x1b[32m" : "\x1b[31m"
        console.log(`  ${color}${icon}\x1b[0m ${svc.name.padEnd(12)} ${svc.url}`)
      }
      break
      
    case "doctor":
      console.log("Running diagnostics...")
      console.log("")
      const doctor = await runDoctor()
      for (const check of doctor.checks) {
        const icon = check.status === "ok" ? "✓" : check.status === "warn" ? "!" : "✗"
        const color = check.status === "ok" ? "\x1b[32m" : check.status === "warn" ? "\x1b[33m" : "\x1b[31m"
        console.log(`  ${color}${icon}\x1b[0m ${check.name.padEnd(12)} ${check.message}`)
      }
      console.log("")
      console.log(doctor.healthy ? "✓ System healthy" : "✗ Issues detected")
      process.exit(doctor.healthy ? 0 : 1)
      
    case "logs":
      console.log("Platform logs:")
      console.log("(See .logs/platform-orchestrator.log)")
      break
      
    case "help":
    case "--help":
    case "-h":
      printHelp()
      break
      
    default:
      console.error(`Unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
}

// main() is called by bin/a2r
