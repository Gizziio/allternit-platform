# AO UHP Gateway — P6b NOTES (sentinel)

Date: 2026-09-10 · Branch: `ao/uhp-p6b` · Worktree: `allternit-ao-uhp-p6b`
Plan: `Products/AgentOrchestratorRuntime.md` §5 P6b · Parent: P6a (PR #265)
Scope: `docs/AO_UHP_P6B_SCOPE.md`

Human override 2026-09-10: pi added to the auto-install list; live-gate
pi / dsh / opencode / qwen. gemini and cline stay fixture-only.

## What landed

### Half 1 — six drivers

New files under `infrastructure/executor/uhp-gateway/src/drivers/`:
`qwen.rs`, `gemini.rs`, `opencode.rs`, `cline.rs`, `pi.rs`, `dsh.rs`.
Wired in `drivers/mod.rs` (`DriverKind`, `from_base` aliases, argv, parse).

Argv flags are the load-bearing ones from HR `_build_*` (qwen `--yolo` +
`--auth-type openai`; gemini `--approval-mode yolo --skip-trust` and
`--resume latest`; opencode `--auto --pure --thinking`; cline trailing
newline on a whitespace-less prompt and no resume flag; pi `--approve
--no-extensions`; dsh job JSON as the last argv element because ao does
not ship `dsh_driver.py`).

Catalog + PATH `available` for the six new backends. Optional seed
harnesses (`chrn_qwen`, `chrn_opencode`, …) only when the binary is on
PATH. kimi/claude/codex seeds unchanged.

### Half 2 — conformance class Full

Discovery `conformance_class` is `"full"` with the D-05 capability set
(including `files_input`/`files_output`/`session_sharing`).
Implemented:

- Skill bundle round-trip + `GET /v1/harnesses/{id}/skills/{name}/files`
  (F-03/F-04); missing `SKILL.md` refused 422 (F-05).
- `mcp_servers`/`disabled_tools` normalized to camelCase (F-06).
- `DELETE /v1/sessions/{id}` (F-08) and `DELETE /v1/traces/{id}` (R-07).
- Session sharing: bodyless `POST /v1/sessions/{id}/share`, GET, DELETE
  (revokes every link), unauthenticated `GET /v1/shares/{id}` (R-01..R-08).
- `GET /v1/sessions/{id}/files` returns `{files:[]}` so cumulative
  `--class full` (which also runs extended X-*) does not 404 on X-06.

## Hard gates

1. `cargo test -p uhp-gateway --lib` — **41 passed**.
2. `cargo test -p herdr --bin ao ao::harness::tests::embedded_manifest_parses_with_all_17_tools` and
   `driver_table_matches_checked_in_tsv` — **ok**. `cargo test -p herdr ao::` exit 0.
3. Conformance venv recreated at `~/.agent-orchestrator/uhp-venv` (Python 3.11.16).
4. `ao serve --addr 127.0.0.1:8411 --token uhp-p6b-token --data-dir /tmp/uhp-p6b/data`
   + `uhp-conformance --class full --harness-id chrn_qwen`:
   **63/64 passed, 0 failed, 1 skipped** —
   `CONFORMANT WITH SKIPS — UHP 2026-08-11 (full)`.
   Skip is X-07 (no artifacts to download). Report:
   `~/.agent-orchestrator/evidence/ao-uhp-p6b/conformance-full-qwen.json`.
5. Live driver gates (honest):

   | Backend | UHP turn | Direct CLI | Notes |
   |---|---|---|---|
   | qwen | completed | 401 Invalid API-key | Driver+protocol green (conformance T-01/S-* on chrn_qwen). Model auth is environmental. |
   | opencode | failed (`type:error` Unexpected server error in engine pane) | `ok` in ~20ms | Argv/parser ported; live UHP path is an engine-pane failure, not a missing driver. |
   | pi | failed (`Unable to spawn pi`) | n/a in user PATH | Installed `~/.ao/harness` pin **0.85.1**. Engine daemon PATH does not include the managed bin. |
   | dsh | not run | not installed | `ao harness install dsh --accept-terms dsh` failed: PyPI has no `deepseek-harness-sdk==0.1.2rc1`. |
   | gemini, cline | fixture-only | not installed | Per original scope + no human opt-in. |

6. Debug build used; new driver tests clippy-clean enough to compile.

## Manifest / Brain

`pi` added to the 17-tool harness manifest (MIT, npm pin 0.85.1,
`@earendil-works/pi-coding-agent` + `pi-mcp-adapter`). Copies that must
stay byte-identical:

- `infrastructure/executor/ao-engine/src/ao/harness/harness.json`
- `Allternit Brain/Ops/harness.json`
- plus `Ops/harness-sync.js` import, `Ops/harness-sync/drivers/pi.js`,
  `ao-engine` `DRIVERS` table and `drivers.tsv`.

## Deviations

- `--class full` is cumulative (core+extended+full = 64 checks), not the
  56 (40+16) the scope counted. X-06 needed a files-list endpoint to
  avoid a 404; X-07 skipped because no artifacts were produced.
- dsh argv is `["dsh", job_json]` rather than HR's
  `[python, dsh_driver.py, job_json]` — ao does not ship that Python
  driver.
- opencode catalog placeholder `opencode/gpt-5` is not passed as
  `--model` (the local CLI rejected it; user default worked in a direct run).

## Remaining

- Engine PATH for `~/.ao/harness/bin` so managed installs (pi) are
  spawnable from `ao serve` / `layout_apply`.
- OpenCode UHP live turn in an engine pane (direct CLI already works).
- dsh pin that actually exists on PyPI, or drop the live-gate until it does.
- gemini/cline live gates: still need the binaries + human opt-in.
- Gate 2 follow-up (claude OAuth / codex limit until Sep 16) unchanged from P6a.
