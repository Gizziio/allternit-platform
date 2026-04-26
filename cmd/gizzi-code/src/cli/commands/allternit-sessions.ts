import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { createSessionManager } from "@allternit/remote-control"

export const AllternitSessionsCommand = cmd({
  command: "sessions [action] [id]",
  describe: "Manage Allternit remote sessions",
  builder: (yargs) =>
    yargs
      .positional("action", {
        type: "string",
        choices: ["list", "connect", "disconnect", "disconnect-all"],
        describe: "Action to perform",
      })
      .positional("id", {
        type: "string",
        describe: "Session ID (for disconnect)",
      })
      .option("type", {
        type: "string",
        choices: ["vm", "capsule", "plugin", "ssh"],
        describe: "Session type (for connect)",
      })
      .option("target", {
        type: "string",
        describe: "Target ID to connect to (for connect)",
      }),
  handler: async (args) => {
    const sessions = createSessionManager()
    const action = args.action || "list"

    try {
      switch (action) {
        case "list": {
          const list = await sessions.list()
          const active = sessions.getActiveSessions()
          UI.empty()
          UI.println(UI.Style.TEXT_INFO_BOLD + "Allternit Remote Sessions")
          UI.empty()

          if (list.length === 0 && active.length === 0) {
            UI.println("  No sessions found")
            return
          }

          if (active.length > 0) {
            UI.println(UI.Style.TEXT_INFO + "Active sessions:")
            for (const session of active) {
              const typeIcon =
                session.type === "vm" ? "VM" : session.type === "capsule" ? "CAPSULE" : session.type === "plugin" ? "PLUGIN" : "LINK"
              UI.println(`  ${UI.Style.TEXT_SUCCESS}● ${typeIcon} ${session.name} (${session.id})`)
              if (session.host && session.port) {
                UI.println(`     ${UI.Style.TEXT_DIM}${session.host}:${session.port}`)
              }
            }
            UI.empty()
          }

          if (list.length > 0) {
            UI.println(UI.Style.TEXT_INFO + "All sessions:")
            for (const session of list) {
              const statusIcon =
                session.status === "connected"
                  ? UI.Style.TEXT_SUCCESS + "●"
                  : session.status === "error"
                    ? UI.Style.TEXT_ERROR + "○"
                    : UI.Style.TEXT_DIM + "○"
              UI.println(`  ${statusIcon} ${session.name} (${session.id}) - ${session.status}`)
            }
          }
          break
        }

        case "connect": {
          if (!args.type || !args.target) {
            UI.error("Please specify --type and --target for connect")
            process.exitCode = 1
            return
          }
          UI.println(`Connecting to ${args.type}: ${args.target}...`)
          const session = await sessions.connect({
            type: args.type as any,
            id: args.target,
          })
          UI.println(UI.Style.TEXT_SUCCESS + `✓ Connected to ${session.name}`)
          UI.println(`  Session ID: ${session.id}`)
          break
        }

        case "disconnect": {
          if (!args.id) {
            UI.error("Please specify a session ID")
            process.exitCode = 1
            return
          }
          UI.println(`Disconnecting session: ${args.id}...`)
          await sessions.disconnect(args.id)
          UI.println(UI.Style.TEXT_WARNING + `✓ Session disconnected`)
          break
        }

        case "disconnect-all": {
          UI.println("Disconnecting all sessions...")
          await sessions.disconnectAll()
          UI.println(UI.Style.TEXT_WARNING + `✓ All sessions disconnected`)
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
