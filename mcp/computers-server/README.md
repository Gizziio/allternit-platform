# @allternit/computers-server

Standalone stdio MCP server exposing the Allternit **Computers API** as MCP
tools. This is the **Phase 5 distribution surface** for Cloud Computer: any
MCP-capable agent client (Claude Desktop, gizzi-code, Kimi Code, …) can drive
Allternit computers through it.

The server is a **thin, first-party HTTP client** over the `allternit-api`
REST routes. No external developer API keys anywhere — auth is the caller's
own Allternit (Clerk) session token.

## Config (env)

| Var | Default | Purpose |
|-----|---------|---------|
| `ALLTERNIT_API_URL` | `http://127.0.0.1:8013` | Base URL of allternit-api. |
| `ALLTERNIT_TOKEN` | — | Clerk bearer token, sent as `Authorization: Bearer …`. |

## Run

```bash
pnpm --filter @allternit/computers-server build
ALLTERNIT_TOKEN=sk_... computers-mcp        # or: node dist/index.js
```

Register it with any MCP client as a stdio server command.

## Tools (22, 1:1 with the REST routes)

Lifecycle — `POST/GET /api/v1/computers*`:

- `computers.create` — `POST /computers`
- `computers.list` — `GET /computers` (filters: `bot_id`, `kind`, `group_id`, `include_roles`)
- `computers.get` — `GET /computers/:id`
- `computers.start` — `POST /computers/:id/start`
- `computers.stop` — `POST /computers/:id/stop`
- `computers.restart` — `POST /computers/:id/restart`
- `computers.resize` — `PATCH /computers/:id/resize` (disk resize requires stopped)
- `computers.clone` — `POST /computers/:id/clone` (body `{name?}`)
- `computers.delete` — `POST /computers/:id/delete` (204; missing ⇒ also 204)

Control:

- `computers.screenshot` — `GET /computers/:id/screenshot` → PNG, **base64** in the result JSON
- `computers.mouse` — `POST /computers/:id/mouse`
- `computers.keyboard` — `POST /computers/:id/keyboard`
- `computers.shell` — `POST /computers/:id/shell`
- `computers.files.upload` — `POST /computers/:id/files/upload?path=…`, raw `application/octet-stream` bytes (`content` arg is base64-decoded before sending)
- `computers.files.download` — `GET /computers/:id/files/download?path=…` → binary, **base64** in the result JSON

Snapshots:

- `computers.snapshots.list` — `GET /computers/:id/snapshots`
- `computers.snapshots.create` — `POST /computers/:id/snapshots` (`{stateful}`)
- `computers.snapshots.restore` — `POST /computers/:id/snapshots/:snapshot_id/restore`
- `computers.snapshots.delete` — `DELETE /computers/:id/snapshots/:snapshot_id`

Desktop templates (Phase 4) — `/api/v1/desktop-templates*`:

- `templates.list` — `GET /desktop-templates` (filters: `os`, `tag`)
- `templates.import` — `POST /desktop-templates/import` (canonical `apiVersion: allternit.ai/v1` `ComputerTemplate` doc as a YAML/JSON string)
- `templates.build` — `POST /desktop-templates/:id/build` (async golden build, 202 on start)

## Approval semantics

Routes backed by the ACI confirmation policy accept an optional **`approvalId`**
string argument, threaded verbatim as the `?approval_id=` query param:

`computers.create`, `computers.start`, `computers.stop`, `computers.restart`,
`computers.resize`, `computers.clone`, `computers.delete`, `computers.mouse`,
`computers.keyboard`, `computers.shell`, `computers.files.upload`,
`templates.build`.

The server **never mints or auto-obtains approvals**. If the action needs
confirmation, the API returns its `confirmation_required` / `approval_denied`
payload and that message is surfaced verbatim as the tool result error, along
with the `approval_id` / `action_hash` the caller must route through the ACI
handoff endpoints (`/api/aci/handoff/:id/*`).

## Layout

- `src/tool-spec.ts` — `McpToolSpec`-style declarations for all 22 tools (id mirrors `sdk/computer-use/src/mcp-tool-spec.ts`)
- `src/client.ts` — thin fetch wrapper over the REST API
- `src/server.ts` — `Server` + `StdioServerTransport` + tool dispatch
- `src/index.ts` — `computers-mcp` bin entry
- `scripts/smoke.mjs` — JSON-RPC handshake smoke test against the built server (`pnpm --filter @allternit/computers-server smoke`)

## Verification

```bash
pnpm --filter @allternit/computers-server build
pnpm --filter @allternit/computers-server test   # vitest: client + tool↔route mapping, mocked fetch
pnpm --filter @allternit/computers-server smoke
```
