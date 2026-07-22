import { Server } from "@/runtime/server/server"
import { cmd } from "@/cli/commands/cmd"
import { withNetworkOptions, resolveNetworkOptions } from "@/cli/network"
import { Flag } from "@/runtime/context/flag/flag"
import { init as initGlobal } from "@/runtime/context/global"

export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) => withNetworkOptions(yargs).option("allow-insecure-network", {
    type: "boolean",
    default: false,
    describe: "allow a non-loopback server without GIZZI_SERVER_PASSWORD (unsafe)",
  }),
  describe: "starts a headless gizzi server",
  handler: async (args) => {
    await initGlobal()
    const opts = await resolveNetworkOptions(args)
    const loopback = opts.hostname === "localhost" || opts.hostname === "127.0.0.1" || opts.hostname === "::1"
    if (!loopback && !Flag.GIZZI_SERVER_PASSWORD && !args.allowInsecureNetwork) {
      throw new Error(
        `Refusing to expose an unauthenticated Gizzi server on ${opts.hostname}. Set GIZZI_SERVER_PASSWORD or pass --allow-insecure-network explicitly.`,
      )
    }
    if (!loopback && !Flag.GIZZI_SERVER_PASSWORD) {
      process.stderr.write("Warning: serving an unauthenticated Gizzi API on a non-loopback interface.\n")
    }
    const server = Server.listen(opts)
    process.stderr.write(`gizzi server listening on http://${server.hostname}:${server.port}\n`)
    await new Promise(() => {})
    await server.stop()
  },
})
