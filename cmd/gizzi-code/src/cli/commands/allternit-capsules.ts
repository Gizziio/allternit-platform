import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { createCapsuleController } from "@allternit/remote-control"

export const A2rCapsulesCommand = cmd({
  command: "capsules [action] [name]",
  describe: "Manage Allternit capsules",
  builder: (yargs) =>
    yargs
      .positional("action", {
        type: "string",
        choices: ["list", "start", "stop", "restart", "logs", "exec"],
        describe: "Action to perform",
      })
      .positional("name", {
        type: "string",
        describe: "Capsule name or ID",
      })
      .option("tail", {
        type: "number",
        describe: "Number of log lines to show",
        default: 50,
      })
      .option("command", {
        type: "string",
        describe: "Command to execute in capsule (for exec action)",
      }),
  handler: async (args) => {
    const capsules = createCapsuleController()
    const action = args.action || "list"

    try {
      switch (action) {
        case "list": {
          const list = await capsules.list()
          UI.empty()
          UI.println(UI.Style.TEXT_INFO_BOLD + "Allternit Capsules")
          UI.empty()

          if (list.length === 0) {
            UI.println("  No capsules found")
            return
          }

          for (const capsule of list) {
            const statusColor =
              capsule.status === "running"
                ? UI.Style.TEXT_SUCCESS
                : capsule.status === "error"
                  ? UI.Style.TEXT_ERROR
                  : UI.Style.TEXT_WARNING
            UI.println(
              `  ${statusColor}${capsule.status.padEnd(10)}${UI.Style.TEXT_NORMAL} ${capsule.name.padEnd(20)}${capsule.ports?.length ? ` Ports: ${capsule.ports.join(", ")}` : ""}`,
            )
          }
          break
        }

        case "start": {
          if (!args.name) {
            UI.error("Please specify a capsule name")
            process.exitCode = 1
            return
          }
          UI.println(`Starting capsule: ${args.name}...`)
          await capsules.start(args.name)
          UI.println(UI.Style.TEXT_SUCCESS + `✓ Capsule ${args.name} started`)
          break
        }

        case "stop": {
          if (!args.name) {
            UI.error("Please specify a capsule name")
            process.exitCode = 1
            return
          }
          UI.println(`Stopping capsule: ${args.name}...`)
          await capsules.stop(args.name)
          UI.println(UI.Style.TEXT_WARNING + `✓ Capsule ${args.name} stopped`)
          break
        }

        case "restart": {
          if (!args.name) {
            UI.error("Please specify a capsule name")
            process.exitCode = 1
            return
          }
          UI.println(`Restarting capsule: ${args.name}...`)
          await capsules.restart(args.name)
          UI.println(UI.Style.TEXT_SUCCESS + `✓ Capsule ${args.name} restarted`)
          break
        }

        case "logs": {
          if (!args.name) {
            UI.error("Please specify a capsule name")
            process.exitCode = 1
            return
          }
          const logs = await capsules.logs(args.name, args.tail)
          UI.empty()
          UI.println(UI.Style.TEXT_INFO_BOLD + `Logs for ${args.name}:`)
          UI.empty()
          UI.println(logs)
          break
        }

        case "exec": {
          if (!args.name) {
            UI.error("Please specify a capsule name")
            process.exitCode = 1
            return
          }
          if (!args.command) {
            UI.error("Please specify a command with --command")
            process.exitCode = 1
            return
          }
          UI.println(`Executing in ${args.name}: ${args.command}`)
          const result = await capsules.exec(args.name, args.command)
          if (result.stdout) UI.println(result.stdout)
          if (result.stderr) UI.println(UI.Style.TEXT_WARNING + result.stderr)
          UI.empty()
          UI.println(`Exit code: ${result.exitCode}`)
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
