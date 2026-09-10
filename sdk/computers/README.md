# @allternit/computers

Framework-free TypeScript SDK for the **Allternit Computers API** — the
cloud-desktop lifecycle, desktop control, file transfer, snapshot, and
desktop-template surface of `allternit-api` (default gateway
`http://127.0.0.1:8013`).

- Zero runtime dependencies (uses global `fetch`; Node ≥ 18).
- Mirrors the real server route shapes (`cmd/allternit-api/src/computer_routes.rs`,
  `bot_desktop_input.rs`, `bot_desktop_snapshots.rs`,
  `bot_desktop_templates.rs`). Field names are the snake_case wire format.
- Thread-safe value object; construct one client and reuse it.

A Python twin lives in [`python/`](./python) with an identical method surface.

## Install

This is a private workspace package:

```bash
pnpm install
pnpm --filter @allternit/computers build
```

```ts
import { ComputersClient } from '@allternit/computers';

const computers = new ComputersClient({
  baseUrl: 'http://127.0.0.1:8013', // default
  token: process.env.ALLTERNIT_TOKEN, // optional Bearer token
});
```

## Approvals (ACI)

Risky calls accept an optional `approvalId` as their last argument. It is
threaded verbatim as the `?approval_id=` query parameter (the server also
accepts camelCase `approvalId`). **The client never obtains approvals for
you** — acquire a grant from the ACI approvals flow first and pass it
through.

## Methods

### REST lifecycle

| Method | Route | Approval |
|---|---|---|
| `listComputers(filters?)` | `GET /api/v1/computers` | — |
| `getComputer(id)` | `GET /api/v1/computers/:id` | — |
| `createComputer(input, approvalId?)` | `POST /api/v1/computers` | ✅ |
| `startComputer(id, approvalId?)` | `POST /api/v1/computers/:id/start` | ✅ |
| `stopComputer(id, approvalId?)` | `POST /api/v1/computers/:id/stop` | ✅ |
| `restartComputer(id, approvalId?)` | `POST /api/v1/computers/:id/restart` | ✅ |
| `resizeComputer(id, input, approvalId?)` | `PATCH /api/v1/computers/:id/resize` | ✅ |
| `cloneComputer(id, name?, approvalId?)` | `POST /api/v1/computers/:id/clone` | ✅ |
| `deleteComputer(id, approvalId?)` | `POST /api/v1/computers/:id/delete` | ✅ |
| `updateComputer(id, input)` | `PATCH /api/v1/computers/:id` (`idle_timeout_secs`, or `null` to clear) | — |
| `sessionEnd(id, approvalId?)` | `POST /api/v1/computers/:id/session-end` (apply persistence policy) | ✅ |

### Desktop control

| Method | Route | Approval |
|---|---|---|
| `screenshot(id)` → `Blob` (PNG) | `GET /api/v1/computers/:id/screenshot` | — |
| `sendMouse(id, input, approvalId?)` | `POST /api/v1/computers/:id/mouse` | ✅ |
| `sendKeyboard(id, input, approvalId?)` | `POST /api/v1/computers/:id/keyboard` | ✅ |
| `runShell(id, input, approvalId?)` | `POST /api/v1/computers/:id/shell` | ✅ |
| `uploadFile(id, path, bytes, approvalId?)` | `POST /api/v1/computers/:id/files/upload?path=...` (raw `application/octet-stream` body) | ✅ |
| `downloadFile(id, path)` → `Blob` | `GET /api/v1/computers/:id/files/download?path=...` | — |

### Snapshots

| Method | Route |
|---|---|
| `listSnapshots(id)` | `GET /api/v1/computers/:id/snapshots` |
| `createSnapshot(id, stateful?)` | `POST /api/v1/computers/:id/snapshots` |
| `restoreSnapshot(id, snapshotId)` | `POST /api/v1/computers/:id/snapshots/:sid/restore` |
| `deleteSnapshot(id, snapshotId)` | `DELETE /api/v1/computers/:id/snapshots/:sid` |

### Desktop templates (Phase 4)

| Method | Route | Approval |
|---|---|---|
| `listTemplates({ os?, tag? }?)` | `GET /api/v1/desktop-templates` | — |
| `getTemplate(id)` | `GET /api/v1/desktop-templates/:id` | — |
| `importTemplate(doc)` | `POST /api/v1/desktop-templates/import` (canonical `apiVersion: allternit.ai/v1` `ComputerTemplate` doc, JSON or YAML string) | — |
| `buildTemplate(id, approvalId?)` | `POST /api/v1/desktop-templates/:id/build` (202; poll `build_status`) | ✅ |

### Phase 5 additions

`getComputerStatus(id)` (`GET /api/v1/computers/:id/status`) and
`createEmbedToken(id)` (`POST /api/v1/computers/:id/embed-token`) are
**Phase 5 additions** — the server routes are landing concurrently with this
SDK, and the response shapes are not yet frozen (typed permissively).

## Errors

Non-2xx responses throw `ComputersApiError` with `status` (number) and
`body` (raw response text).

## Parity matrix (TS ↔ Python ↔ routes)

The Python client in [`python/`](./python) exposes the identical surface
(snake_case methods, same routes, same `approval_id` threading). Full method
detail per language is in each README's Methods section; the rows are 1:1.

| Capability | Route (verb + path) | TS method | Python method | `approval_id` |
|---|---|---|---|---|
| **Lifecycle** |
| Create | `POST /api/v1/computers` | `createComputer(input, approvalId?)` | `create_computer(request, approval_id=...)` | ✅ |
| List | `GET /api/v1/computers?bot_id=&kind=&group_id=&include_roles=1` | `listComputers(filters?)` | `list_computers(bot_id=, kind=, group_id=, include_roles=)` | — |
| Get | `GET /api/v1/computers/:id` | `getComputer(id)` | `get_computer(computer_id)` | — |
| Start | `POST /api/v1/computers/:id/start` | `startComputer(id, approvalId?)` | `start_computer(computer_id, approval_id=...)` | ✅ |
| Stop | `POST /api/v1/computers/:id/stop` | `stopComputer(id, approvalId?)` | `stop_computer(computer_id, approval_id=...)` | ✅ |
| Restart | `POST /api/v1/computers/:id/restart` | `restartComputer(id, approvalId?)` | `restart_computer(computer_id, approval_id=...)` | ✅ |
| Resize | `PATCH /api/v1/computers/:id/resize` | `resizeComputer(id, input, approvalId?)` | `resize_computer(computer_id, request, approval_id=...)` | ✅ |
| Clone | `POST /api/v1/computers/:id/clone` | `cloneComputer(id, name?, approvalId?)` | `clone_computer(computer_id, name=..., approval_id=...)` | ✅ |
| Delete | `POST /api/v1/computers/:id/delete` | `deleteComputer(id, approvalId?)` | `delete_computer(computer_id, approval_id=...)` | ✅ |
| Update | `PATCH /api/v1/computers/:id` (`idle_timeout_secs`) | `updateComputer(id, input)` | `update_computer(computer_id, request)` | — |
| Session end | `POST /api/v1/computers/:id/session-end` | `sessionEnd(id, approvalId?)` | `session_end(computer_id, approval_id=...)` | ✅ |
| **Control** |
| Screenshot | `GET /api/v1/computers/:id/screenshot` → PNG | `screenshot(id)` → `Blob` | `screenshot(computer_id)` → `bytes` | — |
| Mouse | `POST /api/v1/computers/:id/mouse` | `sendMouse(id, input, approvalId?)` | `mouse(computer_id, request, approval_id=...)` | ✅ |
| Keyboard | `POST /api/v1/computers/:id/keyboard` | `sendKeyboard(id, input, approvalId?)` | `keyboard(computer_id, request, approval_id=...)` | ✅ |
| Shell | `POST /api/v1/computers/:id/shell` | `runShell(id, input, approvalId?)` | `shell(computer_id, request, approval_id=...)` | ✅ |
| File upload | `POST /api/v1/computers/:id/files/upload?path=` (raw octet-stream body) | `uploadFile(id, path, bytes, approvalId?)` | `upload_file(computer_id, path, data, approval_id=...)` | ✅ |
| File download | `GET /api/v1/computers/:id/files/download?path=` → binary | `downloadFile(id, path)` → `Blob` | `download_file(computer_id, path)` → `bytes` | — |
| **Snapshots** |
| List | `GET /api/v1/computers/:id/snapshots` | `listSnapshots(id)` | `list_snapshots(computer_id)` | — |
| Create | `POST /api/v1/computers/:id/snapshots` | `createSnapshot(id, stateful?)` | `create_snapshot(computer_id, stateful=...)` | — |
| Restore | `POST /api/v1/computers/:id/snapshots/:sid/restore` | `restoreSnapshot(id, snapshotId)` | `restore_snapshot(computer_id, snapshot_id)` | — |
| Delete | `DELETE /api/v1/computers/:id/snapshots/:sid` | `deleteSnapshot(id, snapshotId)` | `delete_snapshot(computer_id, snapshot_id)` | — |
| **Templates (Phase 4)** |
| List | `GET /api/v1/desktop-templates?os=&tag=` | `listTemplates({ os?, tag? }?)` | `list_templates(os=, tag=)` | — |
| Get | `GET /api/v1/desktop-templates/:id` | `getTemplate(id)` | `get_template(template_id)` | — |
| Import | `POST /api/v1/desktop-templates/import` (canonical `ComputerTemplate` doc; JSON is parsed as YAML) | `importTemplate(doc)` | `import_template(doc)` | — |
| Build | `POST /api/v1/desktop-templates/:id/build` (202; poll `build_status`) | `buildTemplate(id, approvalId?)` | `build_template(template_id, approval_id=...)` | ✅ |
| **Phase 5 additions** (routes landing concurrently; response shapes not frozen) |
| Status | `GET /api/v1/computers/:id/status` | `getComputerStatus(id)` | `get_computer_status(computer_id)` | — |
| Embed token | `POST /api/v1/computers/:id/embed-token` | `createEmbedToken(id)` | `create_embed_token(computer_id)` | — |

## Scripts

```bash
pnpm --filter @allternit/computers test       # vitest (mocked fetch)
pnpm --filter @allternit/computers build      # tsc → dist/
pnpm --filter @allternit/computers typecheck  # tsc --noEmit
```
