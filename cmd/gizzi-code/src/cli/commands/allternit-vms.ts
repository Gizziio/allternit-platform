import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { createVMController } from "@allternit/remote-control"

export const AllternitVMCommand = cmd({
  command: "vms [action] [name]",
  describe: "Manage Allternit virtual machines",
  builder: (yargs) =>
    yargs
      .positional("action", {
        type: "string",
        choices: ["list", "start", "stop", "restart", "logs", "connect"],
        describe: "Action to perform",
      })
      .positional("name", {
        type: "string",
        describe: "VM name or ID",
      })
      .option("tail", {
        type: "number",
        describe: "Number of log lines to show",
        default: 50,
      })
      .option("protocol", {
        type: "string",
        choices: ["ssh", "vnc", "serial"],
        describe: "Connection protocol",
        default: "ssh",
      }),
  handler: async (args) => {
    const vm = createVMController()
    const action = args.action || "list"

    try {
      switch (action) {
        case "list": {
          const vms = await vm.list()
          UI.empty()
          UI.println(UI.Style.TEXT_INFO_BOLD + "Allternit Virtual Machines")
          UI.empty()

          if (vms.length === 0) {
            UI.println("  No VMs found")
            return
          }

          for (const vm of vms) {
            const statusColor =
              vm.status === "running"
                ? UI.Style.TEXT_SUCCESS
                : vm.status === "error"
                  ? UI.Style.TEXT_ERROR
                  : UI.Style.TEXT_WARNING
            UI.println(
              `  ${statusColor}${vm.status.padEnd(10)}${UI.Style.TEXT_NORMAL} ${vm.name.padEnd(20)} ${vm.cpus} CPU ${vm.memory}${vm.ip ? ` ${vm.ip}` : ""}`,
            )
          }
          break
        }

        case "start": {
          if (!args.name) {
            UI.error("Please specify a VM name")
            process.exitCode = 1
            return
          }
          UI.println(`Starting VM: ${args.name}...`)
          await vm.start(args.name)
          UI.println(UI.Style.TEXT_SUCCESS + `✓ VM ${args.name} started`)
          break
        }

        case "stop": {
          if (!args.name) {
            UI.error("Please specify a VM name")
            process.exitCode = 1
            return
          }
          UI.println(`Stopping VM: ${args.name}...`)
          await vm.stop(args.name)
          UI.println(UI.Style.TEXT_WARNING + `✓ VM ${args.name} stopped`)
          break
        }

        case "restart": {
          if (!args.name) {
            UI.error("Please specify a VM name")
            process.exitCode = 1
            return
          }
          UI.println(`Restarting VM: ${args.name}...`)
          await vm.restart(args.name)
          UI.println(UI.Style.TEXT_SUCCESS + `✓ VM ${args.name} restarted`)
          break
        }

        case "logs": {
          if (!args.name) {
            UI.error("Please specify a VM name")
            process.exitCode = 1
            return
          }
          const logs = await vm.logs(args.name, args.tail)
          UI.empty()
          UI.println(UI.Style.TEXT_INFO_BOLD + `Logs for ${args.name}:`)
          UI.empty()
          UI.println(logs)
          break
        }

        case "connect": {
          if (!args.name) {
            UI.error("Please specify a VM name")
            process.exitCode = 1
            return
          }
          UI.println(`Connecting to VM: ${args.name} via ${args.protocol}...`)
          const connection = await vm.connect(args.name, args.protocol as any)
          UI.println(UI.Style.TEXT_SUCCESS + `✓ Connected to ${args.name}`)
          if (connection.url) {
            UI.println(`  URL: ${connection.url}`)
          }
          if (connection.token) {
            UI.println(`  Token: ${connection.token}`)
          }
          break
        }

        default:
          UI.error(`Unknown action: ${action}`)
          process.exitCode = 1
      }
    } catch (error) {
      UI.error(error instanceof Error ? error.message : "Failed to execute command")
      process.exitCode = 1
    }
  },
})
