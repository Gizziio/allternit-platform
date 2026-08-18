import type { Argv } from "yargs"
import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { getStatus } from "@/runtime/services/localEngine"

export const HardwareCommand = cmd({
  command: "hardware",
  describe: "show the detected local hardware profile",
  builder: (yargs: Argv) => {
    return yargs.option("json", {
      describe: "output as JSON",
      type: "boolean",
      default: false,
    })
  },
  handler: async (args) => {
    try {
      const status = await getStatus()
      if (args.json) {
        UI.println(JSON.stringify(status, null, 2))
        process.exit(0)
      }

      UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Local hardware profile" + UI.Style.TEXT_NORMAL)
      UI.println("")
      UI.println(`  OS:        ${status.platform.os} (${status.platform.arch})`)
      UI.println(`  CPU:       ${status.cpu.model} (${status.cpu.cores}c / ${status.cpu.threads}t)`)
      UI.println(`  RAM:       ${(status.ram.total_bytes / 1e9).toFixed(1)} GB`)
      if (status.gpu && status.gpu.length > 0) {
        const gpu = status.gpu[0]
        const mem = gpu.memory_total_mb ? `${(gpu.memory_total_mb / 1024).toFixed(1)} GB` : "unknown"
        UI.println(`  GPU:       ${gpu.name} (${mem})`)
      }
      UI.println(`  Hardware ID: ${status.hardware_id}`)
      if (status.apple_chip) {
        UI.println(`  Apple chip:  ${status.apple_chip}`)
      }
      UI.println(`  Backends:  metal=${status.backends.metal}, cuda=${status.backends.cuda}, cpu=${status.backends.cpu_fallback}`)
      process.exit(0)
    } catch (err) {
      UI.error(err instanceof Error ? err.message : "Failed to reach Local Engine")
      process.exit(1)
    }
  },
})
