import { EOL } from "os"
import { Config } from "@/runtime/context/config/config"
import { bootstrap } from "@/cli/bootstrap/bootstrap"
import { cmd } from "@/cli/commands/cmd"

export const ConfigCommand = cmd({
  command: "config",
  describe: "show resolved configuration",
  builder: (yargs) => yargs,
  async handler() {
    await bootstrap(process.cwd(), async () => {
      const config = await Config.get()
      process.stdout.write(JSON.stringify(config, null, 2) + EOL)
    })
  },
})
