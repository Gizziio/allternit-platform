# UHP gateway (`ao serve`)

Unified Harness Protocol 2026-08-11 surface, in-process under the `ao` binary
(crate `infrastructure/executor/uhp-gateway/`). Not a sidecar. The process
**is** the UHP server; it drives CLI agents through the ao engine socket.

P6a (PR #265) shipped core + kimi/claude/codex. **P6b (PR #280) raised the
class to `full` and added six more drivers.** Executor notes:
`docs/AO_UHP_GATEWAY_NOTES.md` (P6a evidence), `docs/AO_UHP_P6B_NOTES.md`
(P6b evidence). Vendor oracles: `docs/UHP_VENDOR_INVENTORY.md`.

## Start

```bash
ao serve --addr 127.0.0.1:8410 --token "$UHP_TOKEN" --data-dir ~/.ao/uhp
ao serve health --addr 127.0.0.1:8410 --token "$UHP_TOKEN"
```

Missing engine is auto-started. Stop = SIGINT/SIGTERM to the foreground
process. Token also reads `UHP_TOKEN`. Discovery (`GET /v1/uhp`) is
unauthenticated; everything else needs `Authorization: Bearer <token>`.

`GET /v1/uhp` reports `conformance_class: "full"` with
`streaming`, `sessions`, `cancellation`, `files_input`, `files_output`,
`session_listing`, `harness_management`, `session_sharing`, `idempotency`.

Last measured: `uhp-conformance --class full` → 63/64 pass, 1 skip (X-07:
no artifacts to download) → CONFORMANT WITH SKIPS.

## Drivers

| `base` | binary | Seeded harness | Live on this machine (2026-09-10) |
|---|---|---|---|
| `kimi`, `kimi-code` | `kimi` | `chrn_kimi` always | Stream/cancel/resume green (P6a) |
| `claude`, `claude-code` | `claude` | `chrn_claude` always | OAuth expired — environmental |
| `codex` | `codex` | `chrn_codex` always | Usage limit until 2026-09-16 |
| `qwen`, `qwen-code` | `qwen` | if on PATH | Protocol green; model 401 |
| `opencode`, `open-code` | `opencode` | if on PATH | Direct CLI works; engine pane errors |
| `gemini`, `gemini-cli` | `gemini` | if on PATH | Fixture-only until installed |
| `cline` | `cline` | if on PATH | Fixture-only until installed |
| `pi` | `pi` | if on PATH | Installable (`ao harness install pi`, MIT 0.85.1). Engine daemon PATH does not include `~/.ao/harness/bin`, so `ao serve` cannot spawn it yet. |
| `dsh`, `deepseek` | `dsh` | if on PATH | Pin `deepseek-harness-sdk==0.1.2rc1` is not on PyPI |

`available` on catalog models is PATH presence, not a claim. Optional seeds
are skipped when the binary is missing.

UHP owns no keys. Drivers inherit the user's CLI login (or fail the same way
the CLI does).

## Full-class endpoints (P6b)

On top of core (harness CRUD, responses, SSE, cancel, sessions, turns):

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/harnesses/{id}/skills/{name}/files` | Skill bundle round-trip. Create refuses a bundle with no `SKILL.md` (422). |
| DELETE | `/v1/sessions/{id}` | Session gone → 404. |
| DELETE | `/v1/traces/{id}` | Same delete (R-07 name). |
| POST | `/v1/sessions/{id}/share` | Bodyless POST publishes. |
| GET | `/v1/sessions/{id}/share` | Newest live share. |
| DELETE | `/v1/sessions/{id}/share` | Revokes every link for that session. |
| GET | `/v1/shares/{id}` | Unauthenticated read-only view. Share id is not an API credential. |
| GET | `/v1/sessions/{id}/files` | Artifact list. Currently `{ "files": [] }` — listing exists; download (X-07) skips when empty. |

`mcp_servers` / `disabled_tools` on create/update are stored as `mcpServers` /
`disabledTools`.

## Conformance

```bash
python3.11 -m venv ~/.agent-orchestrator/uhp-venv
~/.agent-orchestrator/uhp-venv/bin/pip install -e vendor/harnessrouter-ce/protocol/conformance
# editable install so the JSON schema resolves from the vendor tree
ao serve --addr 127.0.0.1:8410 --token uhp-test --data-dir "$(mktemp -d)"
~/.agent-orchestrator/uhp-venv/bin/uhp-conformance \
  --base-url http://127.0.0.1:8410 --api-key uhp-test \
  --class full --harness-id chrn_kimi --plain
```

`--class full` is cumulative (core + extended + full = 64 checks), not 40+16.

## Still open

- Engine PATH for `~/.ao/harness/bin` so managed installs spawn from `ao serve`.
- OpenCode UHP turn inside an engine pane (direct CLI already works).
- dsh pin that exists on PyPI.
- Gate 2 claude/codex live turns after re-auth / 2026-09-16.
- Artifact download (X-07) once a turn actually writes files.
- CI job that boots `ao serve` and runs the suite.
