import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { getApiUrl } from "@/constants/allternit-api"
import { updateSettingsForSource } from "@/cli/ui/ink-app/utils/settings/settings"
import { Log } from "@/shared/util/log"
import { BrainError, expandBrainPath, initBrain, setBrainRemote } from "./lib"

const log = Log.create({ service: "brain-init" })

/**
 * D1-R4: provision a hosted brain remote via the D2 API. The endpoint does
 * not exist yet — any failure (404, network) returns null and the caller
 * prints the D2 fallback message and exits 0.
 */
async function provisionHostedRemote(): Promise<string | null> {
  try {
    const res = await fetch(getApiUrl("/api/v1/brains"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data: any = await res.json().catch(() => null)
    return data?.clone_url ?? data?.url ?? null
  } catch (e) {
    log.info("hosted remote provisioning unavailable (expected before D2)", {
      error: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

export const BrainInitCommand = cmd({
  command: "init",
  describe: "Create a second brain (git repo of frontmatter markdown)",
  builder: (yargs) =>
    yargs
      .option("path", {
        type: "string",
        describe: "where to create the brain (default: ~/brain)",
      })
      .option("force", {
        type: "boolean",
        describe: "reinitialize even if the target is non-empty",
      })
      .option("remote", {
        type: "boolean",
        describe: "provision a hosted platform remote and set it as origin",
      })
      .example("gizzi brain init", "create a brain at ~/brain")
      .example("gizzi brain init --path ~/Documents/brain", "custom location")
      .example("gizzi brain init --remote", "also provision a hosted remote"),
  handler: async (args) => {
    const target = expandBrainPath((args.path as string | undefined) ?? "~/brain")

    let result
    try {
      result = await initBrain(target, { force: Boolean(args.force) })
    } catch (e) {
      if (e instanceof BrainError) {
        UI.println(UI.Style.TEXT_ERROR + `❌ ${e.message}` + UI.Style.RESET)
        process.exit(1)
      }
      throw e
    }

    // D1-R3: wire the brain into the local agent layer via user settings so
    // memory ingestion / the taste-corpus wiki connector can find it.
    const { error } = updateSettingsForSource("userSettings", {
      brain: { path: result.path },
    })
    if (error) {
      log.warn("could not write brain.path to user settings", {
        error: error.message,
      })
      UI.println(
        UI.Style.TEXT_WARNING +
          `⚠️  brain created, but writing settings failed (${error.message}). ` +
          `Set "brain.path": "${result.path}" in your user settings manually.` +
          UI.Style.RESET,
      )
    }

    UI.println(
      UI.Style.TEXT_SUCCESS + `🧠 Brain created at ${result.path}` + UI.Style.RESET,
    )
    UI.println(`  Initial commit: ${result.commit}`)
    UI.println("  Next: edit identity.md, then read MEMORY.md for the conventions.")

    if (args.remote) {
      const url = await provisionHostedRemote()
      if (url) {
        await setBrainRemote(result.path, url)
        UI.println(UI.Style.TEXT_SUCCESS + `  Hosted remote provisioned: ${url}` + UI.Style.RESET)
      } else {
        UI.println(
          "platform remotes land in D2; run `gizzi brain remote <url>` later",
        )
      }
    }
    process.exit(0)
  },
})
