import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { createVFKitManager } from "@/runtime/vm"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "vm-cli" })

export const VmCommand = cmd({
  command: "vm <action>",
  describe: "Manage local VMs via vfkit",
  builder: (yargs) =>
    yargs
      .positional("action", {
        type: "string",
        choices: ["start", "stop", "restart", "status", "setup", "exec"],
        describe: "VM action",
      })
      .option("command", {
        type: "string",
        alias: "c",
        describe: "Command to execute inside VM (for 'exec' action)",
      })
      .option("cpus", {
        type: "number",
        describe: "Number of CPU cores",
        default: 4,
      })
      .option("memory", {
        type: "number",
        describe: "Memory in MB",
        default: 4096,
      }),

  handler: async (args) => {
    const action = args.action as "start" | "stop" | "restart" | "status" | "setup" | "exec"
    const vm = createVFKitManager({
      cpuCount: args.cpus,
      memorySizeMB: args.memory,
    })

    try {
      switch (action) {
        case "setup": {
          UI.println(UI.Style.TEXT_INFO + "🔧 Checking VM setup..." + UI.Style.RESET)
          await vm.setup()
          UI.println(UI.Style.TEXT_SUCCESS + "✅ VM images are ready" + UI.Style.RESET)
          UI.println("Run `gizzi vm start` to boot the VM")
          break
        }

        case "start": {
          UI.println(UI.Style.TEXT_INFO + "🚀 Starting VM..." + UI.Style.RESET)
          await vm.start()
          UI.println(UI.Style.TEXT_SUCCESS + "✅ VM is running" + UI.Style.RESET)
          UI.println(`   Socket: ${vm.currentStatus.socketPath}`)
          break
        }

        case "stop": {
          UI.println(UI.Style.TEXT_INFO + "🛑 Stopping VM..." + UI.Style.RESET)
          await vm.stop()
          UI.println(UI.Style.TEXT_SUCCESS + "✅ VM stopped" + UI.Style.RESET)
          break
        }

        case "restart": {
          UI.println(UI.Style.TEXT_INFO + "🔄 Restarting VM..." + UI.Style.RESET)
          await vm.restart()
          UI.println(UI.Style.TEXT_SUCCESS + "✅ VM restarted" + UI.Style.RESET)
          break
        }

        case "status": {
          const status = vm.currentStatus
          UI.println(UI.Style.TEXT_INFO_BOLD + "VM Status" + UI.Style.RESET)
          UI.println(`  State:   ${status.state}`)
          UI.println(`  Name:    ${status.vmName}`)
          UI.println(`  PID:     ${status.pid ?? "N/A"}`)
          UI.println(`  Socket:  ${status.socketPath}`)
          UI.println(`  VSOCK:   ${status.vsockPort}`)
          if (status.uptime) {
            const mins = Math.floor(status.uptime / 60)
            const secs = status.uptime % 60
            UI.println(`  Uptime:  ${mins}m ${secs}s`)
          }
          if (status.errorMessage) {
            UI.println(UI.Style.TEXT_ERROR + `  Error:   ${status.errorMessage}` + UI.Style.RESET)
          }
          break
        }

        case "exec": {
          if (!args.command) {
            UI.println(UI.Style.TEXT_ERROR + "❌ No command provided. Use --command or -c" + UI.Style.RESET)
            process.exit(1)
          }

          if (!vm.isRunning) {
            UI.println(UI.Style.TEXT_INFO + "🚀 VM not running, starting..." + UI.Style.RESET)
            await vm.start()
          }

          UI.println(UI.Style.TEXT_INFO + `⚡ ${args.command}` + UI.Style.RESET)
          const result = await vm.execute("/bin/sh", ["-c", args.command])

          if (result.stdout) {
            UI.println(result.stdout)
          }
          if (result.stderr) {
            UI.println(UI.Style.TEXT_WARNING + result.stderr + UI.Style.RESET)
          }
          UI.println(UI.Style.TEXT_INFO + `Exit code: ${result.exit_code}` + UI.Style.RESET)
          break
        }
      }
    } catch (err: any) {
      log.error("vm command failed", { action, error: err.message })
      UI.println(UI.Style.TEXT_ERROR + `❌ Error: ${err.message}` + UI.Style.RESET)
      process.exit(1)
    }
  },
})
