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
import path from "path"
import { cmd } from "./cmd"
import { generateCodemap } from "@/codemap"

export const CodemapCommand = cmd({
  command: "codemap",
  describe: "generate a deterministic architecture map of the current project",
  builder: (yargs) =>
    yargs.command(
      "generate",
      "generate docs/codemap/{codemap.json,codemap.html,codemap.lock}",
      (yargs) =>
        yargs
          .option("dir", { type: "string", describe: "project root (default: cwd)" })
          .option("vault-export", {
            type: "boolean",
            default: false,
            describe: "also export the codemap as wikilinked notes into your vault/brain (opt-in; not run by default or by `gizzi init`)",
          })
          .option("path", {
            type: "string",
            describe: "vault/brain root override for --vault-export (default: ~/brain, same resolution as `gizzi brain`)",
          }),
      async (args) => {
        const dir = args.dir ?? process.cwd()
        const result = await generateCodemap(dir)
        if (result.ok) {
          console.log(`Generated docs/codemap/ at ${dir}`)
          if (result.staleModules.length > 0) {
            console.log(`${result.staleModules.length} module(s) changed since last codemap: ${result.staleModules.join(", ")}`)
          }
          if (args.vaultExport) {
            if (!result.codemap) {
              console.error("Vault export skipped: no codemap data available")
            } else {
              const { exportCodemapToVault } = await import("@/codemap/vault-export")
              const { resolveBrainPath } = await import("@/runtime/brain/path")
              const vaultRoot = resolveBrainPath(args.path)
              const repoName = path.basename(dir)
              const exported = await exportCodemapToVault(result.codemap, repoName, vaultRoot)
              console.log(`Exported ${exported.moduleCount} module(s) to your vault (Codebase/${repoName}/)`)
            }
          }
        } else {
          console.error(`Codemap generation failed: ${result.reason}`)
        }
        process.exit(result.ok ? 0 : 1)
      },
    ),
  handler: () => {},
})
