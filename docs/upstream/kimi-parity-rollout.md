# Kimi-parity rollout and migration

The Kimi-informed runtime changes are additive by default. Existing session rows, permissions,
provider credentials, skills, and messages are not rewritten. Database migrations add append-only
trace and background-task tables; they do not replace the canonical message store.

## Deployment order

1. Apply database migrations and deploy the daemon/runtime.
2. Deploy the web surface so replay inspection and support export become available.
3. Package binaries with `native-assets/<platform>-<arch>/manifest.json` beside the executable.
4. Publish the renamed VS Code extension after confirming the `gizzi` executable is on its host PATH.
5. Remove checked-in or user MCP entries that invoke bundled servers through `npx`; local discovery now owns them.

## Emergency rollback switches

| Variable | Effect | Durable data |
|---|---|---|
| `GIZZI_DISABLE_DURABLE_TRACE=1` | Stops new trace entries. Replay remains readable. | Preserved |
| `GIZZI_DISABLE_CONTEXT_PROJECTION=1` | Sends stored messages without the wire-repair projection. | Unchanged |
| `GIZZI_DISABLE_ACP_CONFIG_OPTIONS=1` | Keeps legacy ACP model/mode fields and suppresses the unified picker. | Unchanged |
| `GIZZI_DISABLE_NATIVE_SIDECAR=1` | Build-time escape hatch; omits native sidecars and uses runtime fallbacks. | N/A |
| `GIZZI_DISABLE_BUNDLED_MCPS=1` | Suppresses locally bundled MCP servers. | User config preserved |
| `GIZZI_DYNAMIC_TOOL_SELECTION=1` | Enables progressive MCP schema disclosure; the equivalent config key is `experimental.dynamic_tool_selection`. | Session history preserved |
| `GIZZI_DISABLE_SCRATCHPAD=1` | Suppresses scratchpad tools and prompt discovery. Existing scratchpad files remain untouched until their sessions are deleted. | Preserved |

These switches are intended for short incident rollback, not permanent configuration. Skill growth
and imports already have preview, approval, content-hash, backup, and rollback gates and therefore do
not need a process-wide destructive rollback.

## Compatibility notes

- ACP clients on older SDKs continue receiving `models`, `modes`, and `_meta`; newer clients also
  receive `configOptions` and `config_option_update`.
- The VS Code extension registers old `gizzi.*` commands as aliases, while menus and settings use
  `gizzi.*`.
- Remote server binds require `GIZZI_SERVER_PASSWORD`; loopback remains password-optional.
- Loopback servers reject unrecognized Host headers, every response carries request/protocol IDs,
  and `/asyncapi` documents event/replay consumers.
- Progressive MCP disclosure is opt-in for the first rollout. Disable the env/config value to
  restore the full provider-visible MCP catalog immediately.
- Telemetry honors `DO_NOT_TRACK`, `DISABLE_TELEMETRY`, and `GIZZI_DISABLE_TELEMETRY`.
