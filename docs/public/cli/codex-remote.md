# Codex Remote

`gizzi serve` turns a local machine into a remote agent host that can be reached from other clients, including the iOS agent bridge and web surfaces. This is Allternit's equivalent to remote/Codex Remote workflows.

## Get started with Remote

Start the local server:

```bash
gizzi serve
```

By default this binds to `localhost` on a configurable port. To expose the server over the internet, use a tunnel or mesh:

```bash
# Cloudflare quick tunnel
gizzi serve --tunnel

# Cloudflare named tunnel
gizzi serve --tunnel --tunnel-token <token> --tunnel-hostname my-agent.example.com

# Tailscale/Headscale mesh
gizzi serve --mesh
```

## Explore setup and security

Remote instances authenticate clients with:

- Password auth (`--password`)
- Clerk JWT (`--clerk-jwks-url`, `--clerk-issuer`, `--require-clerk-auth`)
- mTLS (when served behind a reverse proxy)

Keep the server behind a firewall or tunnel unless you intend to expose it directly. Use strong passwords or JWT validation in production.

## Keep work moving from anywhere

Once the server is running, clients can:

- Discover the instance via the Allternit platform registry when using `--tunnel`.
- Connect over WebSocket or HTTP to run agents against the remote workspace.
- Resume sessions and access the same project context as the local CLI.

## Configuration

```toml
[server]
port = 8080
hostname = "0.0.0.0"
tunnel = true
mesh = false
```

## Related pages

- [Config and state locations](./config-locations.md)
- [Authentication](./authentication.md)
- [Agent approvals and security](./agent-approvals-security.md)
