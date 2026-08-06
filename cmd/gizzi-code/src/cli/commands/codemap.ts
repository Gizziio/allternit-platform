/**
 * Codemap CLI Command
 *
 * Commands:
 * - gizzi codemap generate [--dir]   Generate docs/codemap/{codemap.json,codemap.html,codemap.lock}
 *
 * `gizzi init` already runs this automatically as one of its setup steps
 * (see cli/commands/init.ts) — this standalone command exists to re-run it
 * later without a full re-init, e.g. after a batch of changes, or when
 * dogfooding against a repo that's already been initialized.
 */
import { cmd } from "./cmd"
import { generateCodemap } from "@/codemap"

export const CodemapCommand = cmd({
  command: "codemap",
  describe: "generate a deterministic architecture map of the current project",
  builder: (yargs) =>
    yargs.command(
      "generate",
      "generate docs/codemap/{codemap.json,codemap.html,codemap.lock}",
      (yargs) => yargs.option("dir", { type: "string", describe: "project root (default: cwd)" }),
      async (args) => {
        const dir = args.dir ?? process.cwd()
        const result = await generateCodemap(dir)
        if (result.ok) {
          console.log(`Generated docs/codemap/ at ${dir}`)
          if (result.staleModules.length > 0) {
            console.log(`${result.staleModules.length} module(s) changed since last codemap: ${result.staleModules.join(", ")}`)
          }
        } else {
          console.error(`Codemap generation failed: ${result.reason}`)
        }
        process.exit(result.ok ? 0 : 1)
      },
    ),
  handler: () => {},
})
