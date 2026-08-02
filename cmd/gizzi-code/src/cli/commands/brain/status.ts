import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { getSettingsForSource } from "@/cli/ui/ink-app/utils/settings/settings"
import {
  DEFAULT_BRAIN_PATH,
  expandBrainPath,
  getBrainStatus,
} from "./lib"

/** Settings-backed brain path resolution, shared by status/sync/remote. */
export function resolveBrainPath(flagPath?: string): string {
  if (flagPath) return expandBrainPath(flagPath)
  try {
    const configured = getSettingsForSource("userSettings")?.brain?.path
    if (configured) return expandBrainPath(configured)
  } catch {
    // settings unavailable — fall through to the default
  }
  return DEFAULT_BRAIN_PATH
}

export async function printBrainStatus(flagPath?: string): Promise<void> {
  const path = resolveBrainPath(flagPath)
  const status = await getBrainStatus(path)

  if (!status.exists) {
    UI.println(`No brain found at ${status.path}`)
    UI.println("Run `gizzi brain init` to create one.")
    return
  }

  UI.println(UI.Style.TEXT_INFO_BOLD + "Brain status" + UI.Style.RESET)
  UI.println(`  Path:                ${status.path}`)
  UI.println(`  Remote:              ${status.remote ?? "none"}`)
  UI.println(
    `  Uncommitted changes: ${status.uncommitted.length === 0 ? "none" : String(status.uncommitted.length)}`,
  )
  for (const line of status.uncommitted.slice(0, 10)) {
    UI.println(`    ${line}`)
  }
  if (status.uncommitted.length > 10) {
    UI.println(`    … and ${status.uncommitted.length - 10} more`)
  }
  UI.println(
    `  Unpushed commits:    ${status.unpushed === null ? "n/a (no remote)" : String(status.unpushed)}`,
  )
  UI.println(
    status.clean
      ? UI.Style.TEXT_SUCCESS + "  Clean." + UI.Style.RESET
      : UI.Style.TEXT_WARNING +
          "  Not clean — commit changes and run `gizzi brain sync`." +
          UI.Style.RESET,
  )
}

export const BrainStatusCommand = cmd({
  command: ["status", "$0"],
  describe: "Show brain status (default)",
  builder: (yargs) =>
    yargs.option("path", {
      type: "string",
      describe: "brain path (default: settings brain.path, else ~/brain)",
    }),
  handler: async (args) => {
    await printBrainStatus(args.path as string | undefined)
    process.exit(0)
  },
})
