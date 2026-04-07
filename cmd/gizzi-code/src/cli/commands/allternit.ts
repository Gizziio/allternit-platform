import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"

export const A2rCommand = cmd({
  command: "remote",
  describe: "Remote architecture commands",
  builder: (yargs) =>
    yargs
      .command("vms", "Manage virtual machines", (yargs) =>
        yargs
          .positional("action", {
            type: "string",
            choices: ["list", "start", "stop", "restart", "logs", "connect"],
          })
          .positional("name", { type: "string" }),
      )
      .command("capsules", "Manage capsules", (yargs) =>
        yargs
          .positional("action", {
            type: "string",
            choices: ["list", "start", "stop", "restart", "logs", "exec"],
          })
          .positional("name", { type: "string" }),
      )
      .command("plugins", "Manage plugins", (yargs) =>
        yargs
          .positional("action", {
            type: "string",
            choices: ["list", "install", "uninstall", "enable", "disable", "update"],
          })
          .positional("name", { type: "string" }),
      )
      .command("sessions", "Manage remote sessions", (yargs) =>
        yargs
          .positional("action", {
            type: "string",
            choices: ["list", "connect", "disconnect", "disconnect-all"],
          })
          .positional("id", { type: "string" }),
      )
      .demandCommand(1, "Please specify a subcommand"),
  handler: async (args) => {
    UI.empty()
    UI.println(UI.Style.TEXT_INFO_BOLD + "Remote Control")
    UI.empty()
    UI.println("Usage: gizzi remote <command> [options]")
    UI.empty()
    UI.println("Commands:")
    UI.println("  vms        Manage virtual machines")
    UI.println("  capsules   Manage capsules")
    UI.println("  plugins    Manage plugins")
    UI.println("  sessions   Manage remote sessions")
    UI.empty()
    UI.println(UI.Style.TEXT_DIM + "Run 'gizzi remote <command> --help' for more information on a command.")
  },
})
