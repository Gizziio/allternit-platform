# UHP Vendor Inventory — HarnessRouter Community Edition

Vendored into this worktree as **reference + test-oracle material only** for implementing a Rust
server that passes the UHP (Unified Harness Protocol) conformance suite.

The Rust surface is **full class** as of P6b (PR #280). Operator how-to: `docs/UHP.md`.

> **⚠️ ORACLES ONLY.** Nothing under `vendor/harnessrouter-ce/` is compiled, imported, executed,
> or invoked from any Rust/TS code in this repo. It is not in the cargo workspace. The vendored
> tree exists so the Rust implementation can be checked against the upstream protocol spec,
> JSON schemas, OpenAPI document, conformance-check source, and pytest layouts. Do not wire any
> of its Python into the build.

## Provenance

| Field | Value |
|---|---|
| Upstream | https://github.com/HarnessRouter/harnessrouter |
| Commit | `60c9a4556a4dd9e04dff28ad8404b006747c2204` (default-branch HEAD, shallow clone) |
| Commit date | 2026-09-10T02:08:40-07:00 |
| Vendored | 2026-09-10 |
| License | **Apache License 2.0** — verified verbatim at HEAD; first lines of `LICENSE`: |
| | `Apache License` / `Version 2.0, January 2004` / `http://www.apache.org/licenses/` |
| Size | 23 MB (full tree kept — under the 200 MB slim threshold; the embedded `.git` was stripped at commit time so the vendor directory is a plain tree like `vendor/session-migrate`; provenance is the commit/date rows above) |
| Path | `vendor/harnessrouter-ce/` |

`NOTICE` also present at repo root upstream (empty-ish attribution file; kept with the clone).

## Directory map

```
vendor/harnessrouter-ce/
├── LICENSE, NOTICE, README.md        ← Apache-2.0 + project readme
├── docs/                             ← project docs incl. support-matrix.md(results)
├── protocol/
│   ├── versions/2026-08-11/          ← THE SPEC (markdown): architecture, lifecycle, errors,
│   │                                    tasks, streaming, sessions, harnesses, files, schema,
│   │                                    security, index
│   ├── schema/
│   │   ├── uhp-2026-08-11.schema.json    ← JSON Schema ($defs: Discovery, Response, Event,
│   │   │                                    ErrorEnvelope, Error, Harness, ModelCatalog,
│   │   │                                    HarnessModels, Usage, ContentPart, OutputItem,
│   │   │                                    TurnItem, SessionShare, McpServer, Capabilities, …)
│   │   ├── uhp-2026-08-11.openapi.yaml   ← OpenAPI 22 paths (see endpoint list below)
│   │   └── build.py
│   ├── conformance/                  ← pip package uhp-conformance (THE ORACLE)
│   │   ├── pyproject.toml            ← name uhp-conformance, version 2026.8.11.post1,
│   │   │                                requires-python >=3.10, dep: jsonschema>=4.0
│   │   ├── uhp_conformance/          ← cli.py, client.py, checks.py, context.py,
│   │   │                                registry.py, report.py
│   │   ├── tests/                    ← suite's own unit tests (report shape, reserved fields,
│   │   │                                session sharing)
│   │   ├── reports/                  ← 5 versioned upstream self-run reports (see below)
│   │   └── README.md
│   └── site/, assets/                ← protocol marketing site
├── gateway/                          ← reference FastAPI server (app.py ~13.9k lines)
│   └── tests/                        ← 44 pytest files (layout below)
├── runner/                           ← reference agent-runner (server.py ~5.3k lines)
│   ├── server.py                     ← all backend driver builders + normalizers
│   ├── dsh_driver.py                 ← DeepSeek-harness driver (separate process)
│   └── tests/                        ← 35 pytest files (backend normalizers etc.)
├── ui/                               ← Next.js control UI (reference only)
├── docker/, scripts/                 ← deployment + support-matrix scripts
└── .github/                          ← CI incl. conformance runs
```

## Conformance CLI mechanics (`uhp-conformance`)

Install (from vendored source; NOT published on PyPI — `pip install uhp-conformance` from PyPI
will fail):

```bash
python3.11 -m venv /tmp/uhp-venv          # requires Python >= 3.10 (system python3 is 3.9 — too old)
/tmp/uhp-venv/bin/pip install vendor/harnessrouter-ce/protocol/conformance
```

Schema note: `uhp_conformance/context.py` resolves the JSON schema at
`<repo>/protocol/schema/uhp-2026-08-11.schema.json` **relative to the installed package file**
(`parents[2]` of `uhp_conformance/context.py`). Installing via `pip install <path>` copies only
the `uhp_conformance` package — **the schema is NOT inside the package**, so schema-validating
checks (D-03, E-01, H-01, H-02, H-03, H-04, T-01, S-03, S-07, X-05) will SKIP with
"schema not found" unless the repo tree sits alongside. Run the CLI from a checkout (or keep the
vendored tree in place) so `protocol/schema/` resolves. Checks that don't need the schema still
run.

Invocation (verified runnable on this macOS machine; `--help` captured):

```
usage: uhp-conformance [-h] --base-url BASE_URL [--api-key API_KEY]
                       [--class {core,extended,full}]
                       [--harness-id HARNESS_ID] [--model MODEL]
                       [--task-timeout TASK_TIMEOUT] [--json JSON_OUT]
                       [--only ONLY] [--plain]

options:
  --base-url BASE_URL   Server root, e.g. https://host or
                        http://127.0.0.1:3000/api/harness   (REQUIRED)
  --api-key API_KEY     Bearer token (or set UHP_API_KEY)
  --class {core,extended,full}  cumulative; default: core
  --harness-id HARNESS_ID  Run tasks against this harness id
  --model MODEL         Run tasks with this model
  --task-timeout TASK_TIMEOUT  seconds per agent task, default 300
  --json JSON_OUT       write JSON report to this path
  --only ONLY           comma-separated check ids
  --plain               no ANSI colour
```

- Target server URL: `--base-url` (required); may include a path prefix (`/api/harness`). All
  request paths below are appended to it.
- Auth: `Authorization: Bearer <api-key>` on every request **except** checks that pass
  `auth=False` (D-01/D-02, unauthenticated probes). Key from `--api-key` or `UHP_API_KEY`.
- HTTP client is deliberately thin: no retries, no redirect chasing, no exceptions — every check
  sees the exact status/headers/body. Bodies are JSON with `content-type: application/json`,
  `accept: application/json`; streaming POSTs use `accept: text/event-stream` and parse SSE
  `data:` lines incrementally (buffering is measurable by check S-09).
- Harness selection: first harness from `GET /v1/harnesses` unless `--harness-id` matches.
- Task fixtures: one blocking task (`stream: false`) and one streaming task (`stream: true`),
  prompt `"Reply with exactly: ok"`, body
  `{"input": ..., "metadata": {"harness_id": <id>}, "stream": <bool>[, "model": ...]}` — run
  once, shared across checks. Exit code 0 = all pass, 1 = any FAIL/ERROR, 2 = `--only` matched
  nothing.
- Outcomes: PASS / FAIL / SKIP / ERROR. A SKIP is never a pass; `conformant` in the JSON report
  requires zero skips.

### Check classes (64 total: core 40, extended 8, full 16)

Classes are cumulative (`--class extended` runs core + extended).

### FULL core-class check list (40)

Convention: "→" = request, "⇒" = assertion. Fixture tasks use the request body above.

**Discovery & version negotiation (8)**

| ID | Endpoint | Assertions |
|---|---|---|
| D-01 | `GET /v1/uhp` (no auth) | ⇒ 200; body is a JSON object; reports `conformance_class`, `versions`. Schema: `$defs.Discovery` (required: `object, protocol, versions, default_version, conformance_class, capabilities`; `capabilities` has boolean keys `streaming, sessions, cancellation, files_input, files_output, session_listing, harness_management, session_sharing, idempotency`). |
| D-02 | `GET /v1/uhp` (no auth) | ⇒ 200 without any credential (discovery precedes auth). |
| D-03 | (discovery doc) | validates against `Discovery` schema. |
| D-04 | (discovery doc) | `default_version ∈ versions`. |
| D-05 | (discovery doc) | `conformance_class` (core/extended/full) agrees with capabilities: core requires `streaming, sessions, cancellation`; extended adds `files_input, files_output, session_listing`; full adds `harness_management`. |
| V-01 | `GET /v1/uhp` | every response carries a `UHP-Version` header. |
| V-02 | `GET /v1/uhp` + header `UHP-Version: <versions[0]>` | ⇒ 200 and response `UHP-Version` header equals the requested version. |
| V-03 | `GET /v1/uhp` + header `UHP-Version: 1999-01-01` | ⇒ 400; `error.code == "unsupported_protocol_version"`; `error.detail.supported` is a non-empty list. |

**Auth & error envelope (6)**

| ID | Endpoint | Assertions |
|---|---|---|
| A-01 | `GET /v1/harnesses` (no auth) | ⇒ 401. |
| A-02 | `GET /v1/harnesses` + `Authorization: Bearer uhp-conformance-not-a-key` | ⇒ 401; `error.type == "authentication_error"`. |
| E-01 | `GET /v1/harnesses/chrn_uhpconformancenosuchharness00` | ⇒ 404; body validates `ErrorEnvelope` (`error` required; `Error` requires `type, code, message`, optional `param, detail`). |
| E-02 | same | `error.code == "harness_not_found"`. |
| E-03 | `GET /v1/responses/resp_uhpconformancenosuchresponse` | ⇒ 404; `error.code == "response_not_found"`. |
| E-04 | same | `error.message` leaks no internals: must not contain `Traceback`, `File "/`, `  at `, or `\n  File`. |

**Harnesses & models (4)**

| ID | Endpoint | Assertions |
|---|---|---|
| H-01 | `GET /v1/harnesses` | ⇒ 200; body has `harnesses` array; each entry validates `Harness` (required `id, name, base`; camelCase extras like `defaultModel, mcpServers, skills, disabledTools`). |
| H-02 | `GET /v1/harnesses/{id}` | ⇒ 200; `id` round-trips; validates `Harness`. |
| H-03 | `GET /v1/models` | ⇒ 200; validates `ModelCatalog` (required `backends`, object keyed by backend → `{models: [...]}`); every model's `available` is a **boolean**. |
| H-04 | `GET /v1/harnesses/{id}/models` | ⇒ 200; validates `HarnessModels`. |

**Tasks (10)**

| ID | Endpoint | Assertions |
|---|---|---|
| T-01 | `POST /v1/responses` (blocking fixture) | ⇒ 200; body validates `Response` (required `id, object, created_at, status, output, model`; `status` enum: `in_progress, completed, failed, incomplete, cancelled`; `usage` keys: `input_tokens, output_tokens, total_tokens, cache_read_tokens, cache_write_tokens`). |
| T-02 | (same fixture) | terminal `status ∈ {completed, failed, incomplete, cancelled}`. |
| T-03 | (same) | `model` non-empty; if `metadata.requested_model` differs from `model`, then `metadata.model_fallback` must be `true`. |
| T-04 | (same) | `metadata.session_id` present (non-empty). |
| T-05 | (same) | `usage` key exists; value is `null` or an object (never fabricated). |
| T-06 | `GET /v1/responses/{id}` | ⇒ 200; same `id`; `status` unchanged from the POST (terminal states are stable). |
| T-07 | (same) | `id` starts with `resp_`. |
| T-08 | `POST /v1/responses` with reserved fields `tools` (a function + an MCP-shaped entry) and `include: ["uhp.conformance.not_a_real_value"]` | ⇒ 200; ran to `completed`/`incomplete` — reserved fields must be **ignored, not rejected**. |
| T-09 | (same reserved-fixture) | `metadata.ignored_fields` exists, is a list of strings, and contains both `"tools"` and `"include"`. |
| T-10 | (plain fixture) | `metadata.ignored_fields` must NOT name `tools`/`include` when the request sent neither. |

**Streaming (9)** — `POST /v1/responses` with `stream: true`, `Accept: text/event-stream`; events are SSE `data:` JSON objects.

| ID | Assertions |
|---|---|
| S-01 | stream emits ≥ 1 event. |
| S-02 | response `content-type` contains `text/event-stream`. |
| S-03 | every event validates `Event` (required `type` (string), `sequence_number` (integer); optional `response, item, part, delta, text, arguments, item_id, output_index, content_index, code, message, param…`). |
| S-04 | `sequence_number` starts at 0 and is gapless/monotonic over the whole stream. |
| S-05 | first event `type == "response.created"`. |
| S-06 | exactly one terminal event (`response.completed` / `response.incomplete` / `response.failed`) and it is the **last** event. |
| S-07 | the terminal event carries a `response` object validating `Response` with terminal status. |
| S-08 | blocking and streaming agree: both carry `object` and `status`, both `object == "response"`. |
| S-09 | **progressiveness**: events (≥3) must span > 50 ms of arrival time (an end-flushed buffer fails this). |

**Sessions & cancellation (3)**

| ID | Endpoint | Assertions |
|---|---|---|
| C-01 | `POST /v1/responses` with `previous_response_id: <rid>` | ⇒ 200; `metadata.session_id` equals the first task's session; `previous_response_id` echoed in the response. |
| C-02 | `POST /v1/responses/{rid}/cancel` on an already-terminal task | ⇒ 200 **or 409**; the task's `status` is unchanged by the cancel. |
| C-03 | start `{"input": "Count slowly from 1 to 200…", "background": true}`, sleep 2 s, `POST /v1/responses/{rid}/cancel` | ⇒ 200; within 90 s the task reaches a terminal status. |

**Extended class (8, for reference):** X-01 `GET /v1/sessions?limit=5` lists sessions; X-02 listing
has pagination marker (`next_cursor`/`cursor`/`has_more`); X-03 `GET /v1/sessions/{id}`; X-04
`GET /v1/sessions/{id}/turns` → `turns` array of `TurnItem` (id + status); X-05 inline file input
(`input_file` content part with `data:` URL) accepted; X-06 `GET /v1/sessions/{id}/files` →
`files` array; X-07 `GET /v1/containers/{cid}/files/{fid}/content` ⇒ 200 + `X-Content-Type-Options:
nosniff`; X-08 path-traversal probes (`../../etc/passwd`, `..%2f..%2fetc%2fpasswd`) refused (400/403/404, no `root:` in body).

**Full class (16, for reference):** F-01 harness create/update/delete round-trip
(`POST/PUT/DELETE /v1/harnesses[/{id}]`); F-02 unsupported base refused (400/422); F-03 skill
folder round-trips incl. nested + binary members (`GET /v1/harnesses/{id}/skills/{name}/files`);
F-04 unrelated edit preserves skill contents; F-05 skill bundle without SKILL.md refused;
F-06 `mcpServers` + `disabledTools` round-trip; F-07 created harnesses cleaned up; F-08
`DELETE /v1/sessions/{id}` ⇒ 2xx then GET ⇒ 404. R-01..R-08 session sharing: `POST
/v1/sessions/{id}/share` (bodyless POST publishes; 404/405/501 = not implemented = skip), view
readable unauthenticated, `GET …/share` agrees with POST, share id is not an API credential,
view is read-only (write probes refused), view leaks no credential-shaped fields
(`auth/token/secret/env/headers/…`), `DELETE …/share` revokes every minted link, deleting the
session kills the view, bodyless POST publishes.

### Versioned report JSONs

`protocol/conformance/reports/` holds 5 upstream self-runs: `harnessrouter-ce-0.3.0.json`,
`0.7.0`, `0.8.0`, `0.8.2-rc`, `0.9.0-rc`. Shape (from 0.9.0-rc, 52 checks at `full`):

```json
{
  "protocol": "uhp",
  "protocol_version": "2026-08-11",
  "suite_version": "2026.8.11.post1",
  "generated_at": "<UTC ISO8601>",
  "target": "<base-url or label>",
  "requested_class": "full",
  "conformant": true,                    // zero fail/error/skip — skips demote the verdict
  "conformant_with_skips": true,         // zero fail/error
  "skipped_not_verified": ["<check ids>"],
  "highest_class_passed": "full",
  "summary": {"pass": 52, "fail": 0, "skip": 0, "error": 0, "total": 52},
  "checks": [{"id": "D-01", "title": "…", "class": "core",
              "spec": "protocol/versions/2026-08-11/lifecycle.md#2-capability-discovery",
              "outcome": "pass", "detail": "…"}]
}
```

Note: reports 0.3.0–0.8.x predate `suite_version`/`generated_at`/`skipped_not_verified` (added in
suite 2026.8.11.post1). Report count differs by vintage (52 vs 64) because checks were added over
time — HEAD's suite defines 64.

## OpenAPI path surface (from `protocol/schema/uhp-2026-08-11.openapi.yaml`)

```
GET    /v1/uhp                      GET    /v1/sessions
GET    /v1/harnesses                GET    /v1/sessions/{session_id}
POST   /v1/harnesses                GET    /v1/sessions/{session_id}/turns
GET    /v1/harnesses/{harness_id}   POST   /v1/sessions/{session_id}/share
PUT    /v1/harnesses/{harness_id}   GET    /v1/sessions/{session_id}/share
DELETE /v1/harnesses/{harness_id}   DELETE /v1/sessions/{session_id}/share
GET    /v1/models                   POST   /v1/sessions/{session_id}/cancel
GET    /v1/harnesses/{id}/models    POST   /v1/files
POST   /v1/responses                GET    /v1/sessions/{id}/files
GET    /v1/responses/{response_id}  GET    /v1/sessions/{id}/files/archive
GET    /v1/responses/{id}/input_items
POST   /v1/responses/{id}/cancel
GET    /v1/containers/{cid}/files/{fid}/content
GET    /v1/containers/{cid}/files/{fid}/pdf
```

## Runner driver notes (`runner/server.py`)

The runner spawns CLI agents in per-session sandboxed workspaces and normalizes every backend to
a canonical **Claude Code `stream-json`** event shape. Registered backends: `claude, codex,
hermes, pi, dsh, opencode, qwen, gemini, cline, omp` (BACKENDS map at `server.py:4007`).

**⚠️ There is no `kimi` backend.** "kimi" appears only in comments/tests (e.g. a pi/dsh normalizer
comment about a kimi channel whose deltas and final text disagreed) and in
`docs/support-matrix.md`, where kimi models (`kimi-k2.7-code`, `kimi-k3`) are served **via
OpenRouter** through the dsh/omp/hermes/opencode backends. An ao-side kimi driver has no upstream
oracle here.

**claude (Claude Code CLI)** — `_build_claude` (`server.py:1211`):
- Invocation: `claude -p <prompt> --output-format stream-json --verbose
  --dangerously-skip-permissions --max-turns N [--include-partial-messages]
  [--mcp-config <file>] [--plugin-dir <dir>]… [--resume <session-id>] [--model <model>]`.
- Prompt: positional after `-p`. Providers via env: `anthropic` (`ANTHROPIC_API_KEY`,
  `ANTHROPIC_BASE_URL` — runner strips a trailing `/v1`, the CLI appends `/v1/messages` itself),
  `bedrock` (`CLAUDE_CODE_USE_BEDROCK=1` + AWS vars), `vertex` (`CLAUDE_CODE_USE_VERTEX=1` +
  GCP vars + SA json), `tokenrouter` (`ANTHROPIC_AUTH_TOKEN` + base_url).
- Config/session home redirected into the checkpointed workspace:
  `CLAUDE_CONFIG_DIR=<cwd>/.harness/home/.claude` (session transcripts under `projects/*.jsonl`).
- `_claude_thinking_env(model)` disables thinking/effort fields the target model rejects.
- Parsing: `--output-format stream-json` → NDJSON events on stdout. Normalizer
  `_claude_passthrough` maps `stream_event.content_block_delta` `text_delta`/`thinking_delta` to
  canonical assistant events, **strips text/thinking from the final `assistant` message** (deltas
  already streamed them — avoids double render), keeps `tool_use` blocks; the `result` event's
  text is replaced with the accumulated streamed final.
- Resume: `--resume <id>` only if the `projects/**/<id>.jsonl` transcript actually exists in the
  (re)hydrated workspace; otherwise starts fresh in the same workspace. Disabled tools go into
  `settings.json` `permissions.deny` (NOT `--disallowedTools`, which is ignored under
  `--dangerously-skip-permissions` — verified both ways).
- Usage: from the `result` event's usage fields.

**codex (OpenAI Codex CLI)** — `_build_codex` (`server.py:1583`) + app-server driver (`server.py:4196`):
- Two modes. Exec: `codex exec [resume --last] --dangerously-bypass-approvals-and-sandbox
  --skip-git-repo-check --json -c model=<m> [--cd <cwd>] <prompt>`. App-server (only mode that
  streams assistant text): `codex app-server` JSON-RPC — spawn → initialize →
  thread start/resume → turn; notifications carry `item`/`agentMessage/delta` and
  `thread/tokenUsage/updated`.
- Prompt: positional (exec) / turn params (app-server). Config: `config.toml` written into
  `CODEX_HOME=<cwd>/.harness/home/.codex` — `model_provider = "hr-<provider>"` (namespaced; Codex
  rejects overriding built-in ids), `approval_policy = "never"`,
  `sandbox_mode = "danger-full-access"` (required for app-server), `wire_api = "responses"` (chat
  completions removed from current Codex), `model_context_window`. Providers: `openai`, `azure`,
  `tokenrouter` (env keys `OPENAI_API_KEY` / `AZURE_OPENAI_API_KEY` / `ROUTER_API_KEY`).
- Parsing: exec `--json` → NDJSON events normalized by `_codex_to_claude` (`server.py:1116`):
  item kinds mapped (reasoning → `thinking` blocks, message/agent_message → text,
  function/command_execution → tool calls); item shape shared with the app-server driver.
- Reasoning/thinking stripping: `_sanitize_codex_rollout` — on resume under a changed account
  fingerprint, drops `encrypted_content` from reasoning items (account-bound blob) and removes
  provider-minted item ids (`msg_/rs_/fc_/fcr_/ctc_` prefixes) so replayed history is content,
  not server-side references (prevents `invalid_encrypted_content` / dangling-reference 400s).
- Token usage: `_norm_token_usage` unwraps `tokenUsage.total.{inputTokens, outputTokens,
  cachedInputTokens, cacheWriteInputTokens}` (app-server) or top-level snake_case (exec) and
  **subtracts cached read from input** so `input_tokens` = fresh tokens only.
- Resume: `codex exec resume --last` (CODEX_HOME is per-session so newest rollout = this
  conversation); every provider id the session ever ran under is re-declared in config.toml.
  Missing rollout → fresh start with a "conversation no longer available" note.
- Cancellation (all backends): runner `POST /turn/{turn_id}/cancel` keeps the live `Popen`
  handle on the turn record and does `os.killpg(os.getpgid(pid), SIGKILL)` — process-group kill
  of the CLI and its children (`server.py:4094`).

## `gateway/tests/` layout (44 files, reference pytest suite)

Areas covered: harness routing/slugs (`test_aggregator_slugs.py`,
`test_backend_of_harness.py`, `test_backend_restricted_wiring.py`), model catalog honesty
(`test_base_catalog_honesty.py`, `test_catalog_chat_only_backends.py`,
`test_model_catalog_capabilities.py`, `test_servable_models.py`, `test_pricing_visibility.py`),
error envelope (`test_response_error_envelope.py`), sessions (`test_deleted_session.py`,
`test_session_delete.py`, `test_session_delete_mirrors.py`, `test_turn_path_reads.py`,
`test_turns_feed_model.py`, `test_turn_record_connection.py`, `test_turn_failure_message.py`,
`test_incomplete_reason.py`), sharing (`test_share_selfhost.py`), files/media
(`test_file_blob_list.py`, `test_files_archive.py`, `test_media_attack.py`,
`test_media_mcp.py`, `test_vision_auth.py`, `test_session_file_fallback.py`), workspaces
(`test_workspaces.py`, `test_workspace_write_durability.py`, `test_fs_workspace.py` in pkg),
storage (`test_sql_plane.py`, `test_read_caches.py`, `test_database_mcp.py`), providers
(`test_broker_google_unknown.py`, `test_broker_provider_base.py`,
`test_broker_strips_thinking.py`, `test_gemini_backend.py`, `test_google_provider.py`,
`test_google_provider_catalog.py`, `test_owner_azure_base.py`), task semantics
(`test_ignored_fields.py`, `test_bus_tasks.py`, `test_card_settle.py`,
`test_hydrate_abort.py`, `test_recycle_route.py`, `test_hid_prefix.py`,
`test_cline_followup.py`, `test_codex_family_switch.py`, `test_sandbox_broker_origin.py`,
`test_cloud_upload.py`) + `conftest.py`.

`runner/tests/` (35 files) covers per-backend normalizers and drivers: claude (error filter,
plugins, base_url), codex (items, reasoning strip, sandbox, appserver thread), dsh (normalize,
gemini schema, google unknown, thought signature), hermes (hang, relay, responses family),
opencode (base_url, normalize), pi normalize, qwen/gemini builds, cline, omp, token-usage
normalization, session uids, turn handles, workspace delete + fixtures.

## Surprises / gotchas

1. **No kimi driver upstream.** Kimi is served via OpenRouter through generic backends; the ao
   kimi driver must be designed from the CLI's own interface, using the conformance suite (not
   upstream driver code) as its oracle.
2. The schema file is **outside** the pip package — schema checks skip if the conformance dir
   isn't on disk relative to the installed package.
3. `usage.input_tokens` must exclude cache-read tokens (upstream subtracts them for billing
   uniformity).
4. C-02 requires cancel of a *terminal* task to return 200 **or 409** — idempotent-cancel
   friendly.
5. S-09 measures arrival spread: a server (or proxy) that buffers SSE and flushes at the end
   fails core.
6. T-08/T-09: `tools` and `include` are reserved — must be accepted, ignored, and reported in
   `metadata.ignored_fields`; and falsely reporting them when not sent is also a failure (T-10).
7. `id` prefixes: responses `resp_`, harnesses `chrn_`, containers `cntr_`.
8. Discovery must be served **unauthenticated** and must carry the `UHP-Version` response header
   on every response, including errors.
9. Python ≥3.10 required for the CLI (machine's default `python3` is 3.9.6; homebrew
   `python3.11`/`3.14` work — installed and `--help` verified 2026-09-10).
