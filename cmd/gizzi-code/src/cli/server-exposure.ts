/**
 * Shared "never expose an unauthenticated gizzi server" guard for the
 * commands that start the HTTP/WebSocket server (`gizzi serve`, `gizzi web`).
 * Both commands serve the same {@link Server} app and the same auth
 * middleware — the only auth surface that used to diverge was this startup
 * policy: `serve` refused a non-loopback unauthenticated bind while `web`
 * only printed a warning. Factored here so both commands enforce identical
 * rules.
 *
 * A server counts as authenticated when either the shared password
 * (GIZZI_SERVER_PASSWORD) or mandatory Bearer validation
 * (GIZZI_REQUIRE_CLERK_AUTH, which also accepts durable `alt_` gateway
 * tokens) is configured. A tunnel exposes even a loopback bind to the
 * public internet, so it follows the same rule.
 */
export function isLoopbackHostname(hostname: string | undefined) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
}

export function serverAuthConfigured() {
  // Read env live at guard time rather than the frozen Flag consts (which
  // capture these vars when the flag module is first imported): this guard
  // runs at command startup, long after flag initialization, and tests plus
  // CLI flag parsing toggle these vars mid-process.
  const env = process.env
  return !!(
    env.GIZZI_SERVER_PASSWORD ||
    env.GIZZI_REQUIRE_CLERK_AUTH === "true" ||
    env.GIZZI_REQUIRE_CLERK_AUTH === "1"
  )
}

export function assertSafeServerExposure(input: {
  command: string
  hostname: string
  tunnel?: boolean
  allowInsecureNetwork?: boolean
}) {
  const exposed = !isLoopbackHostname(input.hostname) || !!input.tunnel
  if (!exposed) return
  if (serverAuthConfigured()) return
  if (input.allowInsecureNetwork) {
    process.stderr.write("Warning: serving an unauthenticated Gizzi API on a non-loopback interface.\n")
    return
  }
  throw new Error(
    `Refusing to expose an unauthenticated Gizzi server${
      input.tunnel ? " via --tunnel" : ` on ${input.hostname}`
    }. Set GIZZI_SERVER_PASSWORD, set GIZZI_REQUIRE_CLERK_AUTH=true to require Bearer tokens, or pass --allow-insecure-network explicitly.`,
  )
}
