import path from "path"
import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { initializeProject } from "@/runtime/project/init"

export const InitCommand = cmd({
  command: "init",
  describe: "initialize gizzi in the current project",
  builder: (yargs) =>
    yargs.option("skip-codemap", {
      type: "boolean",
      default: false,
      describe: "skip automatic docs/codemap/ generation",
    }),
  handler: async (args) => {
    const dir = process.cwd()

    UI.empty()
    UI.println(UI.Style.TEXT_INFO_BOLD + "Initializing gizzi..." + UI.Style.TEXT_NORMAL)
    UI.empty()

    const result = await initializeProject(dir, { skipCodemap: args.skipCodemap })

    for (const created of result.created) {
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + "  +  " + UI.Style.TEXT_NORMAL + created)
    }

    if (result.project) {
      UI.println(
        UI.Style.TEXT_SUCCESS_BOLD + "  ✓  " + UI.Style.TEXT_NORMAL + `Detected ${result.project.name} project`,
      )
    }

    for (const warning of result.warnings) {
      UI.println(UI.Style.TEXT_WARNING_BOLD + "  !  " + UI.Style.TEXT_NORMAL + warning)
    }

    if (result.codemap) {
      if (result.codemap.ok) {
        UI.println(UI.Style.TEXT_SUCCESS_BOLD + "  +  " + UI.Style.TEXT_NORMAL + "Generated docs/codemap/ (codemap.json, codemap.html, codemap.lock)")
        if (result.codemap.staleModules && result.codemap.staleModules.length > 0) {
          UI.println(UI.Style.TEXT_DIM + "  ·  " + UI.Style.TEXT_NORMAL + `${result.codemap.staleModules.length} module(s) changed since last codemap: ${result.codemap.staleModules.join(", ")}`)
        }
      } else {
        UI.println(UI.Style.TEXT_WARNING_BOLD + "  !  " + UI.Style.TEXT_NORMAL + `Codemap generation skipped: ${result.codemap.reason ?? "unknown"}`)
      }
    }

    UI.empty()
    UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Done!" + UI.Style.TEXT_NORMAL + " Edit GIZZI.md to configure your project.")
    UI.empty()
    process.exit(0)
  },
})
