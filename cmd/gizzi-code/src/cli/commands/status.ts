import type { Argv } from "yargs"
import { cmd } from "@/cli/commands/cmd"
import { bootstrap } from "@/cli/bootstrap/bootstrap"
import { Installation } from "@/shared/installation"
import { getCwdState } from "@/bootstrap/state"
import { getHarnessMode, shouldUseHarness } from "@/cli/feature-flags"

export const StatusCommand = cmd({
  command: "status",
  describe: "show current session status",
  builder: (yargs: Argv) => {
    return yargs
      .option("json", {
        describe: "output status as JSON",
        type: "boolean",
        default: false,
      })
      .option("inline", {
        describe: "output status as plain text",
        type: "boolean",
        default: false,
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const status = {
        directory: getCwdState(),
        version: Installation.VERSION,
        harness: {
          mode: getHarnessMode(),
          enabled: shouldUseHarness(),
        },
      }

      if (args.json) {
        process.stdout.write(JSON.stringify(status, null, 2) + "\n")
        process.exit(0)
      }

      process.stdout.write(`gizzi status\n`)
      process.stdout.write(`  Directory: ${status.directory}\n`)
      process.stdout.write(`  Version:   ${status.version}\n`)
      process.stdout.write(`  Harness:   ${status.harness.mode} (enabled: ${status.harness.enabled})\n`)
      if (!args.inline) {
        process.stdout.write(`\nRun with --json for machine-readable output.\n`)
      }
      process.exit(0)
    })
  },
})
