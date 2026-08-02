import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { BrainError, setBrainRemote } from "./lib"
import { resolveBrainPath } from "./status"

export const BrainRemoteCommand = cmd({
  command: "remote <url>",
  describe: "Set the brain's git origin to <url> (manual; hosted remotes land in D2)",
  builder: (yargs) =>
    yargs
      .positional("url", {
        type: "string",
        describe: "git URL to use as origin",
        demandOption: true,
      })
      .option("path", {
        type: "string",
        describe: "brain path (default: settings brain.path, else ~/brain)",
      })
      .example(
        "gizzi brain remote https://git.example.com/me/brain.git",
        "point the brain at an existing git remote",
      ),
  handler: async (args) => {
    const path = resolveBrainPath(args.path as string | undefined)
    try {
      await setBrainRemote(path, args.url as string)
    } catch (e) {
      if (e instanceof BrainError) {
        UI.println(UI.Style.TEXT_ERROR + `❌ ${e.message}` + UI.Style.RESET)
        process.exit(1)
      }
      throw e
    }
    UI.println(UI.Style.TEXT_SUCCESS + `✅ Brain remote set: ${args.url}` + UI.Style.RESET)
    UI.println("Run `gizzi brain sync` to push your history there.")
    process.exit(0)
  },
})
