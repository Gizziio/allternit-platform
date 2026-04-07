import { Server } from "@/runtime/server/server"
import { cmd } from "@/cli/commands/cmd"
import { withNetworkOptions, resolveNetworkOptions } from "@/cli/network"
import { Flag } from "@/runtime/context/flag/flag"

export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) => withNetworkOptions(yargs),
  describe: "starts a headless gizzi server",
  handler: async (args) => {
    if (!Flag.GIZZI_SERVER_PASSWORD) {
      process.stderr.write("Warning: GIZZI_SERVER_PASSWORD is not set; server is unsecured.\n")
    }
    const opts = await resolveNetworkOptions(args)
    const server = Server.listen(opts)
    process.stderr.write(`gizzi server listening on http://${server.hostname}:${server.port}\n`)
    await new Promise(() => {})
    await server.stop()
  },
})
