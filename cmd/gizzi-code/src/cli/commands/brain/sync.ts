import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { syncBrain } from "./lib"
import { resolveBrainPath } from "./status"

export const BrainSyncCommand = cmd({
  command: "sync",
  describe: "Sync the brain with its remote (git pull --rebase, then push)",
  builder: (yargs) =>
    yargs.option("path", {
      type: "string",
      describe: "brain path (default: settings brain.path, else ~/brain)",
    }),
  handler: async (args) => {
    const path = resolveBrainPath(args.path as string | undefined)
    const result = await syncBrain(path)

    switch (result.kind) {
      case "no-brain":
        UI.println(`No brain found at ${result.path}`)
        UI.println("Run `gizzi brain init` to create one.")
        process.exit(0)
        break

      case "no-remote":
        UI.println(`Brain at ${result.path} has no remote configured — nothing to sync.`)
        UI.println(
          "Set one with `gizzi brain remote <url>` (hosted platform remotes land in D2).",
        )
        process.exit(0)
        break

      case "dirty":
        UI.println(
          UI.Style.TEXT_WARNING +
            `You have ${result.files.length} uncommitted change(s) in ${result.path}:` +
            UI.Style.RESET,
        )
        for (const f of result.files.slice(0, 10)) UI.println(`  ${f}`)
        UI.println("Commit them first:")
        UI.println(`  git -C ${result.path} add -A && git -C ${result.path} commit -m "notes"`)
        UI.println("Then run `gizzi brain sync` again.")
        process.exit(1)
        break

      case "conflict":
        UI.println(UI.Style.TEXT_ERROR + "Rebase stopped on conflicts:" + UI.Style.RESET)
        if (result.output) UI.println(result.output)
        UI.println("")
        UI.println("Resolve them by hand — sync never auto-resolves:")
        UI.println(`  1. Fix the conflicted files in ${result.path}`)
        UI.println(`  2. git -C ${result.path} add <fixed files>`)
        UI.println(`  3. git -C ${result.path} rebase --continue`)
        UI.println("  4. Run `gizzi brain sync` again")
        UI.println(`  (or abort with: git -C ${result.path} rebase --abort)`)
        process.exit(1)
        break

      case "pull-failed":
        UI.println(UI.Style.TEXT_ERROR + "git pull --rebase failed:" + UI.Style.RESET)
        if (result.output) UI.println(result.output)
        UI.println("Fix the issue above, then run `gizzi brain sync` again.")
        process.exit(1)
        break

      case "push-failed":
        UI.println(UI.Style.TEXT_ERROR + "git push failed:" + UI.Style.RESET)
        if (result.output) UI.println(result.output)
        UI.println("Fix the issue above, then run `gizzi brain sync` again.")
        process.exit(1)
        break

      case "ok":
        UI.println(
          UI.Style.TEXT_SUCCESS +
            (result.upToDate ? "Brain already up to date." : "Brain synced.") +
            UI.Style.RESET,
        )
        process.exit(0)
        break
    }
  },
})
