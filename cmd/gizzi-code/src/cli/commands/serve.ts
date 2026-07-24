import { Server } from "@/runtime/server/server"
import { cmd } from "@/cli/commands/cmd"
import { withNetworkOptions, resolveNetworkOptions } from "@/cli/network"
import { Flag } from "@/runtime/context/flag/flag"
import { Config } from "@/runtime/context/config/config"
import { init as initGlobal } from "@/runtime/context/global"

export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) =>
    withNetworkOptions(yargs)
      .option("allow-insecure-network", {
        type: "boolean",
        default: false,
        describe: "allow a non-loopback server without GIZZI_SERVER_PASSWORD (unsafe)",
      })
      .option("tunnel", {
        type: "boolean",
        default: false,
        describe: "expose the server through a cloudflared quick tunnel (requires cloudflared)",
      })
      .option("tunnel-token", {
        type: "string",
        describe:
          "run a Cloudflare named tunnel with this token (from `cloudflared tunnel token <name>`); implies --tunnel",
      })
      .option("tunnel-hostname", {
        type: "string",
        describe: "public hostname mapped to the named tunnel (enables the stable URL in logs and registration)",
      }),
  describe: "starts a headless gizzi server",
  handler: async (args) => {
    await initGlobal()
    const opts = await resolveNetworkOptions(args)
    const tunnelExplicitlySet = process.argv.includes("--tunnel") || process.argv.includes("--no-tunnel")
    const config = await Config.global()
    const tunnelFlag = tunnelExplicitlySet ? args.tunnel : (config?.server?.tunnel ?? args.tunnel)
    const tunnelToken = args.tunnelToken ?? Flag.GIZZI_TUNNEL_TOKEN ?? config?.server?.tunnel_token
    const tunnelHostname = args.tunnelHostname ?? Flag.GIZZI_TUNNEL_HOSTNAME ?? config?.server?.tunnel_hostname
    // A named-tunnel token implies tunnel mode even without --tunnel.
    const tunnel = tunnelFlag || !!tunnelToken

    const loopback = opts.hostname === "localhost" || opts.hostname === "127.0.0.1" || opts.hostname === "::1"
    // Auth counts as configured when either the shared password is set or
    // Clerk JWT validation is required (the JWKS URL has a working default).
    const authConfigured = !!Flag.GIZZI_SERVER_PASSWORD || Flag.GIZZI_REQUIRE_CLERK_AUTH
    // A tunnel exposes even a loopback server to the public internet, so the
    // same "never expose an unauthenticated server" rule applies.
    const exposed = !loopback || tunnel
    if (exposed && !authConfigured && !args.allowInsecureNetwork) {
      throw new Error(
        `Refusing to expose an unauthenticated Gizzi server${tunnel ? " via --tunnel" : ` on ${opts.hostname}`}. Set GIZZI_SERVER_PASSWORD, set GIZZI_REQUIRE_CLERK_AUTH=true to require Clerk JWTs, or pass --allow-insecure-network explicitly.`,
      )
    }
    if (exposed && !authConfigured) {
      process.stderr.write("Warning: serving an unauthenticated Gizzi API on a non-loopback interface.\n")
    }
    const server = Server.listen({ ...opts, tunnel, tunnelToken, tunnelHostname })
    process.stderr.write(`gizzi server listening on http://${server.hostname}:${server.port}\n`)
    await new Promise(() => {})
    await server.stop()
  },
})
