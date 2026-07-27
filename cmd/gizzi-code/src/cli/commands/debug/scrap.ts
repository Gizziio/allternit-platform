// @ts-nocheck
import { EOL } from "os"
import { Project } from "@/runtime/context/project/project"
import { Log } from "@/runtime/util/log"
import { cmd } from "@/cli/commands/cmd"

export const ScrapCommand = cmd({
  command: "scrap",
  describe: "list all known projects",
  builder: (yargs) => yargs,
  async handler() {
    const timer = Log.Default.time("scrap")
    const list = await Project.list()
    process.stdout.write(JSON.stringify(list, null, 2) + EOL)
    timer.stop()
  },
})
