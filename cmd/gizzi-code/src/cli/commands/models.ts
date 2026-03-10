import type { Argv } from "yargs"
import { Instance } from "@/runtime/context/project/instance"
import { Provider } from "@/runtime/providers/provider"
import { ModelsDev } from "@/runtime/providers/adapters/models"
import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { EOL } from "os"

export const ModelsCommand = cmd({
  command: "models [provider]",
  describe: "list all available models",
  builder: (yargs: Argv) => {
    return yargs
      .positional("provider", {
        describe: "provider ID to filter models by",
        type: "string",
        array: false,
      })
      .option("verbose", {
        describe: "use more verbose model output (includes metadata like costs)",
        type: "boolean",
      })
      .option("refresh", {
        describe: "refresh the models cache from models.dev",
        type: "boolean",
      })
      .option("all", {
        describe: "show all available providers (not just configured ones)",
        type: "boolean",
        default: true,
      })
  },
  handler: async (args) => {
    if (args.refresh) {
      await ModelsDev.refresh()
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Models cache refreshed" + UI.Style.TEXT_NORMAL)
    }

    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        // Get all providers from models.dev (not just configured ones)
        const modelsDev = await ModelsDev.get()
        const configured = await Provider.list()

        function printModels(providerID: string, verbose?: boolean) {
          const devProvider = modelsDev[providerID]
          const configuredProvider = configured[providerID]
          const provider = configuredProvider || devProvider
          if (!provider) return
          
          const sortedModels = Object.entries(provider.models).sort(([a], [b]) => a.localeCompare(b))
          for (const [modelID, model] of sortedModels) {
            process.stdout.write(`${providerID}/${modelID}`)
            process.stdout.write(EOL)
            if (verbose) {
              process.stdout.write(JSON.stringify(model, null, 2))
              process.stdout.write(EOL)
            }
          }
        }

        // Use models.dev as the source of truth for available providers
        const providersToShow = args.all ? modelsDev : configured

        if (args.provider) {
          if (!providersToShow[args.provider]) {
            UI.error(`Provider not found: ${args.provider}`)
            return
          }

          printModels(args.provider, args.verbose)
          return
        }

        const providerIDs = Object.keys(providersToShow).sort((a, b) => {
          const aIsGIZZI = a.startsWith("gizzi")
          const bIsGIZZI = b.startsWith("gizzi")
          if (aIsGIZZI && !bIsGIZZI) return -1
          if (!aIsGIZZI && bIsGIZZI) return 1
          return a.localeCompare(b)
        })

        for (const providerID of providerIDs) {
          printModels(providerID, args.verbose)
        }
      },
    })
  },
})
