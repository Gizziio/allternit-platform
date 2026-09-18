import { EOL } from "os"
import { Project } from "@/runtime/context/project/project"
import { Log } from "@/runtime/util/log"
import { cmd } from "@/cli/commands/cmd"

export const ScrapCommand = cmd({
  command: "scrap",
  describe: "list all known projects",
  builder: (yargs) => yargs,
  async handler() {
    // TODO(types): the runtime/util/log Log class has no Default timer; the
    // debug commands expect the shared/util/log Logger shape (Log.Default.time).
    const { Default } = Log as unknown as {
      Default: { time: (message: string) => { stop(): void } }
    }
    const timer = Default.time("scrap")
    const list = await Project.list()
    process.stdout.write(JSON.stringify(list, null, 2) + EOL)
    timer.stop()
  },
})
