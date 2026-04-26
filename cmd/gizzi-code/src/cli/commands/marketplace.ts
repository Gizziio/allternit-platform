import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "marketplace-cli" })

export const MarketplaceCommand = cmd({
  command: "marketplace [action]",
  describe: "Plugin marketplace — discover and install plugins",
  builder: (yargs) =>
    yargs
      .positional("action", {
        type: "string",
        choices: ["list", "search", "install", "update", "info"],
        describe: "Marketplace action",
        default: "list",
      })
      .option("query", {
        type: "string",
        alias: "q",
        describe: "Search query",
      })
      .option("plugin", {
        type: "string",
        alias: "p",
        describe: "Plugin name (for install/info)",
      })
      .option("marketplace", {
        type: "string",
        alias: "m",
        describe: "Marketplace source",
      }),

  handler: async (args) => {
    const action = args.action as "list" | "search" | "install" | "update" | "info"

    UI.println(UI.Style.TEXT_INFO_BOLD + "🏪 Plugin Marketplace" + UI.Style.RESET)
    UI.println(UI.Style.TEXT_WARNING + "Use `gizzi plugin` commands for full plugin management." + UI.Style.RESET)
    UI.empty()

    try {
      switch (action) {
        case "list": {
          UI.println(UI.Style.TEXT_INFO + "Available marketplaces:" + UI.Style.RESET)
          UI.println("  • official (Gizzi official plugins)")
          UI.println("  • community (Community-contributed plugins)")
          UI.println("\nRun `gizzi plugin list` to see installed plugins")
          break
        }

        case "search": {
          if (!args.query) {
            UI.println(UI.Style.TEXT_ERROR + "❌ No search query. Use --query or -q" + UI.Style.RESET)
            process.exit(1)
          }
          UI.println(UI.Style.TEXT_INFO + `🔍 Searching for "${args.query}"...` + UI.Style.RESET)
          UI.println(UI.Style.TEXT_WARNING + "Search requires marketplace sync. Run `gizzi plugin sync` first." + UI.Style.RESET)
          break
        }

        case "install": {
          if (!args.plugin) {
            UI.println(UI.Style.TEXT_ERROR + "❌ No plugin specified. Use --plugin or -p" + UI.Style.RESET)
            process.exit(1)
          }
          UI.println(UI.Style.TEXT_INFO + `📦 Installing ${args.plugin}...` + UI.Style.RESET)
          UI.println(`Use \`gizzi plugin install ${args.plugin}\` for full installation`)
          break
        }

        case "update": {
          UI.println(UI.Style.TEXT_INFO + "🔄 Checking for updates..." + UI.Style.RESET)
          UI.println("Use `gizzi plugin update` to update all plugins")
          break
        }

        case "info": {
          if (!args.plugin) {
            UI.println(UI.Style.TEXT_ERROR + "❌ No plugin specified. Use --plugin or -p" + UI.Style.RESET)
            process.exit(1)
          }
          UI.println(UI.Style.TEXT_INFO_BOLD + `📋 ${args.plugin}` + UI.Style.RESET)
          UI.println("Plugin info requires marketplace sync.")
          break
        }
      }
    } catch (err: any) {
      log.error("marketplace command failed", { action, error: err.message })
      UI.println(UI.Style.TEXT_ERROR + `❌ Error: ${err.message}` + UI.Style.RESET)
      process.exit(1)
    }
  },
})
