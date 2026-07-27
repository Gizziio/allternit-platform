import { Global } from "@/runtime/context/global/index"
import { bootstrap } from "@/cli/bootstrap/bootstrap"
import { cmd } from "@/cli/commands/cmd"
import { ConfigCommand } from "@/cli/commands/debug/config"
import { FileCommand } from "@/cli/commands/debug/file"
import { LSPCommand } from "@/cli/commands/debug/lsp"
import { RipgrepCommand } from "@/cli/commands/debug/ripgrep"
import { ScrapCommand } from "@/cli/commands/debug/scrap"
import { SkillCommand } from "@/cli/commands/debug/skill"
import { SnapshotCommand } from "@/cli/commands/debug/snapshot"
import { AgentCommand } from "@/cli/commands/debug/agent"

export const DebugCommand = cmd({
  command: "debug",
  describe: "debugging and troubleshooting tools",
  builder: (yargs) =>
    yargs
      .command(ConfigCommand)
      .command(LSPCommand)
      .command(RipgrepCommand)
      .command(FileCommand)
      .command(ScrapCommand)
      .command(SkillCommand)
      .command(SnapshotCommand)
      .command(AgentCommand)
      .command(PathsCommand)
      .command({
        command: "wait",
        describe: "wait indefinitely (for debugging)",
        async handler() {
          await bootstrap(process.cwd(), async () => {
            await new Promise((resolve) => setTimeout(resolve, 1_000 * 60 * 60 * 24))
          })
        },
      })
      .demandCommand(),
  async handler() {},
})

const PathsCommand = cmd({
  command: "paths",
  describe: "show global paths (data, config, cache, state)",
  handler() {
    for (const [key, value] of Object.entries(Global.Path)) {
      console.log(key.padEnd(10), value)
    }
  },
})
