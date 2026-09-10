# allternit-computers-sdk

Stdlib-only synchronous Python client for the **Allternit Computers API** —
same surface as the TypeScript twin in the parent directory
(`@allternit/computers`). No third-party dependencies (`urllib` only);
targets Python ≥ 3.9 (`from __future__ import annotations`,
`typing.Dict`/`Optional` style, matching `sdk/computer-use/python`).

## Usage

```python
from allternit_computers import AllternitComputersClient

computers = AllternitComputersClient(
    base_url="http://127.0.0.1:8013",  # default
    token="...",                        # or api_key="..."; optional Bearer token
    timeout_seconds=30,
)

created = computers.create_computer(
    {"kind": "cloud_desktop", "name": "dev-box", "cpu_cores": 4},
    approval_id="appr-42",  # optional; threaded as ?approval_id=
)
computers.start_computer(created["id"], approval_id="appr-42")
png = computers.screenshot(created["id"])
out = computers.run_shell(created["id"], {"command": ["uname", "-a"]})
```

Run from a checkout without installing:

```bash
cd sdk/computers/python
PYTHONPATH=src python3 -c "from allternit_computers import AllternitComputersClient"
```

## Approvals (ACI)

Risky calls take an optional keyword-only `approval_id`, threaded verbatim as
the `?approval_id=` query parameter (the server also accepts camelCase
`approvalId`). **The client never obtains approvals for you** — acquire a
grant from the ACI approvals flow first and pass it through.

## Parity matrix (TS ↔ Python ↔ routes)

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

## Errors

Non-2xx responses raise `ComputersAPIError` (a `RuntimeError`) carrying
`.status` (HTTP code) and `.payload` (decoded JSON body, or raw text if not
JSON).

## Tests

```bash
cd sdk/computers/python
python3 -m unittest discover -s tests -v
```

The suite mocks `urllib.request.urlopen` and asserts method, URL, headers,
and body for lifecycle + approval threading, list filters, control calls,
file upload/download paths, snapshots, and templates.
