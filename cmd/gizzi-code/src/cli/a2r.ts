
/**
 * GIZZI Unified CLI
 *
 * Single entry point for:
 * - Platform lifecycle (up/down/status/doctor/logs)
 * - TUI launcher (tui)
 *
 * Replaces: 7-apps/cli (Rust) + bin/gizzi wrapper
 */

import { startPlatform, stopPlatform, getPlatformStatus, runDoctor } from "@/cli/platform/daemon"

const VERSION = "0.1.0"

function printHelp() {
  process.stdout.write(`
GIZZI - A2rchitect Platform Command ${VERSION}

Usage: gizzi [command]

Commands:
  tui         Launch Terminal UI (chat interface)
  up          Start platform services
  down        Stop platform services
  status      Show platform status
  doctor      Run diagnostics
  logs        Show platform logs
  help        Show this help

Examples:
  gizzi tui              # Launch chat interface
  gizzi up               # Start platform
  gizzi status           # Check if running
  gizzi doctor           # Diagnose issues
`)
}

export async function main() {
  const command = process.argv[2]

  switch (command) {
    case "tui":
    case undefined:
    case "":
      // Launch TUI - this is the default
      process.stdout.write("Launching GIZZI Terminal UI...\n")
      // Import and start TUI
      const { TuiThreadCommand } = await import("../cli/ui/tui/thread")
      await TuiThreadCommand.handler({} as any)
      break

    case "up":
      process.stdout.write("Starting GIZZI platform...\n")
      const start = await startPlatform()
      if (start.success) {
        process.stdout.write("✓ Platform starting (check status in a few seconds)\n")
      } else {
        process.stderr.write("✗ Failed to start: " + String(start.error) + "\n")
        process.exit(1)
      }
      break

    case "down":
      process.stdout.write("Stopping GIZZI platform...\n")
      await stopPlatform()
      process.stdout.write("✓ Platform stopped\n")
      break

    case "status":
      const status = await getPlatformStatus()
      process.stdout.write((status.running ? "Platform: RUNNING" : "Platform: STOPPED") + "\n")
      process.stdout.write("\n")
      process.stdout.write("Services:\n")
      for (const svc of status.services) {
        const icon = svc.status === "running" ? "●" : "○"
        const color = svc.status === "running" ? "\x1b[32m" : "\x1b[31m"
        process.stdout.write(`  ${color}${icon}\x1b[0m ${svc.name.padEnd(12)} ${svc.url}\n`)
      }
      break

    case "doctor":
      process.stdout.write("Running diagnostics...\n")
      process.stdout.write("\n")
      const doctor = await runDoctor()
      for (const check of doctor.checks) {
        const icon = check.status === "ok" ? "✓" : check.status === "warn" ? "!" : "✗"
        const color = check.status === "ok" ? "\x1b[32m" : check.status === "warn" ? "\x1b[33m" : "\x1b[31m"
        process.stdout.write(`  ${color}${icon}\x1b[0m ${check.name.padEnd(12)} ${check.message}\n`)
      }
      process.stdout.write("\n")
      process.stdout.write((doctor.healthy ? "✓ System healthy" : "✗ Issues detected") + "\n")
      process.exit(doctor.healthy ? 0 : 1)

    case "logs":
      process.stdout.write("Platform logs:\n")
      process.stdout.write("(See .logs/platform-orchestrator.log)\n")
      break

    case "help":
    case "--help":
    case "-h":
      printHelp()
      break

    default:
      process.stderr.write(`Unknown command: ${command}\n`)
      printHelp()
      process.exit(1)
  }
}

// main() is called by bin/gizzi
