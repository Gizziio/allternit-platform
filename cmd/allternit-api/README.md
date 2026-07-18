# allternit-api

Allternit API service (axum, port 8013). Hosts the platform routes plus the
Office add-in gateway, including the OfficeCLI integration under
`/api/v1/office/cli/*`.

## OfficeCLI backend

The Office add-in uploads document snapshots to this service; the `officecli`
binary runs server-side against those snapshots (read / query / render /
validate / mutate / create), plus resident sessions, `watch` previews and an
MCP stdio bridge (`POST /api/v1/office/cli/mcp`).

### Installing officecli (production gateway)

```sh
brew install officecli        # or the official install.sh from the OfficeCLI repo
officecli --version           # verify it runs
officecli config autoUpdate false   # disable self-updates on servers
```

The gateway resolves the binary in this order:

1. `OFFICECLI_BIN` env var (set this in production),
2. `officecli` on `PATH`,
3. `~/.officecli/bin/officecli`.

Startup probes `officecli --version` (non-fatal);
`GET /api/v1/office/cli/capabilities` reports availability to the add-in.

### Configuration (env-first accessors in `src/config.rs`)

| Env var | Default | Purpose |
| --- | --- | --- |
| `OFFICECLI_BIN` | PATH → `~/.officecli/bin/officecli` | Path to the officecli binary |
| `ALLTERNIT_OFFICE_CLI_DIR` | `<data_dir>/office-cli` | Snapshot docs, artifacts, `docs.json` registry |
| `OFFICECLI_MCP_ARGS` | `mcp,serve` | Args that start the MCP stdio server — **verify against the installed binary** (`officecli mcp --help`) |
| `ALLTERNIT_OFFICECLI_LIVE_FS` | `true` when self-hosted/local-dev, else `false` | Allow officecli directly against on-disk file paths (transport model 3); must be `false` when the gateway is remote |
| `ALLTERNIT_OFFICECLI_WATCH_PORTS` | `26400-26419` | Port range for `officecli watch` preview servers |

### Runtime behaviour

- Snapshots live in `<office_cli_dir>/<user_id>/<doc_id>/`; render/dump/merge
  outputs go to an `artifacts/` subdirectory and are served back via
  `GET /office/cli/document/:doc_id/artifact/:name`.
- The registry (`docs.json`) is rewritten on every mutation and reloaded at
  startup.
- Idle reaper (60 s cadence): docs idle > 24 h are flushed (`officecli save`),
  closed and deleted; resident sessions idle > 15 min are closed; watch
  processes idle > 30 min and MCP sessions idle > 15 min are killed.
- `watch` preview: when the gateway is local, the add-in uses
  `http://127.0.0.1:<port>` directly; when remote, it uses
  `GET /office/cli/watch/:doc_id/proxy` (best-effort plain-GET reverse proxy —
  if the binary's auto-refresh needs WebSocket, live-refresh degrades to
  manual reload).
- Exec timeouts: default 60 s, capped at 300 s; stdout truncated at 1 MiB.
