# AO UHP Gateway — P6a NOTES (sentinel)

Date: 2026-09-10 · Branch: `ao/uhp-gateway` · Executor: P6a (uhp-gateway session)
Spec: `Research/specs/ao-uhp-gateway.md` (Brain) · Binding prep: `Research/drafts/prep-p6-uhp-gateway.md`
Plan: `Products/AgentOrchestratorRuntime.md` §2.6, §5 P6a

## What this is

The UHP (Unified Harness Protocol) 2026-08-11 **core-class** execution layer, in Rust,
as a new workspace crate `infrastructure/executor/uhp-gateway/`, mounted **in-process**
under `ao serve` (not a sidecar). It turns UHP Responses-API calls into real CLI-agent
turns driven through the ao engine (herdr) Unix-socket JSON-RPC API — the P1 headless
substrate. **No herdr engine internals changed**; the only herdr diff is additive
(`src/ao/serve.rs`, one `cli.rs` match arm, help lines, one path dependency).

HarnessRouter CE is vendored at `vendor/harnessrouter-ce/` (Apache-2.0, HEAD `60c9a45`)
as **reference + test oracles only** — no shipped Python, nothing invoked from ao.
Attribution in `THIRD_PARTY_NOTICES.md`; inventory in `docs/UHP_VENDOR_INVENTORY.md`.

## What works (verified live, 2026-09-10, this machine)

- `ao serve [--addr] [--token] [--data-dir] [--engine-socket]` boots the UHP surface
  in-process, auto-starting the engine daemon when absent (same probe as the ao
  contract commands). `ao serve health` probes `GET /v1/uhp`. Stop = SIGINT/SIGTERM
  to the foreground process.
- Discovery unauthenticated + `UHP-Version` header on every response; version pin
  honored, unsupported version refused with `unsupported_protocol_version`.
- Bearer auth on everything except `GET /v1/uhp`; 401 `authentication_error` envelope.
- Harness CRUD (`chrn_` ids), model catalog with binary-presence `available`,
  per-harness models. Seeded harnesses: `chrn_kimi`, `chrn_claude`, `chrn_codex`.
- Responses: blocking + `stream:true` (SSE `response.created` → deltas → exactly one
  terminal event, gapless `sequence_number` from 0, progressive — S-09 measured 6.7 s
  spread), `background:true`, `POST /v1/responses/:id/cancel` (mid-flight cancel →
  `cancelled`; terminal cancel → 200 unchanged), `previous_response_id` session
  continuation (same `metadata.session_id`, driver-native resume ref), Idempotency-Key
  replay returns the stored response (verified: same id, no second turn).
- Reserved fields `tools`/`include` accepted, ignored, reported in
  `metadata.ignored_fields`; never reported when not sent.
- Model fallback: unserved model → backend default + `metadata.requested_model` +
  `model_fallback: true`.
- Sessions: `GET /v1/sessions` (limit/cursor), `GET /v1/sessions/:id`,
  `GET /v1/sessions/:id/turns`. Per-session workspace dirs under
  `<data-dir>/sessions/<id>/workspace`; SQLite (`uhp.db`) + transcript files backing;
  state survives server restart (store test `persistence_across_reopen`).
- kimi driver end-to-end: blocking turn (`"ok"`), SSE stream, mid-flight cancel,
  resume with correct recall (answered "ok" to "what word did I ask for?").

## Hard gates — commands + results

### Gate 1: uhp-conformance core — **GREEN 40/40**

```bash
./target/debug/ao serve --addr 127.0.0.1:8410 --token uhp-test-token-6a --data-dir $UHP_DIR &
cd vendor/harnessrouter-ce
/tmp/uhp-venv/bin/uhp-conformance --base-url http://127.0.0.1:8410 \
  --api-key uhp-test-token-6a --class core --harness-id chrn_kimi --plain \
  --json ~/.agent-orchestrator/evidence/ao-uhp-gateway/conformance-core-kimi.json
```

```
Summary
  40/40 passed · 0 failed · 0 skipped · 0 errored
  CONFORMANT — UHP 2026-08-11 (core)
```

Report JSON: `~/.agent-orchestrator/evidence/ao-uhp-gateway/conformance-core-kimi.json`
(`"conformant": true`, `{"pass": 40, "fail": 0, "skip": 0, "error": 0}`).
(First run was 37/40 — `output[].id` serialized `null` against the schema; fixed by
emitting `msg_<response_id>` item ids; rerun green.)
The venv is an **editable** install of `vendor/harnessrouter-ce/protocol/conformance`
so the suite resolves the JSON schema from the vendored tree (otherwise 10 checks SKIP
and `conformant` is unreachable — see the inventory's schema-path gotcha).
`--harness-id chrn_kimi` because claude/codex turns are environmentally blocked
(see Gate 2); the CLI's documented default is "first harness".

### Gate 2: stream / cancel / resume per backend — **kimi GREEN; claude + codex RED (environmental)**

Harness script (POST stream → background+cancel → previous_response_id resume),
transcripts in `~/.agent-orchestrator/evidence/ao-uhp-gateway/gate2-{kimi,claude,codex}.*`:

| Backend | Stream | Cancel mid-flight | Resume (same session) | Turn outcome |
|---|---|---|---|---|
| kimi (`chrn_kimi`) | created→delta→completed, seq 0..2 | `in_progress`→`cancelled` in <10 s | session match, recalled "ok", `completed` | ✅ real turns |
| claude (`chrn_claude`) | created→delta→failed | terminal (turn fails in ~1 s) | session match, prev echoed | ❌ `Failed to authenticate: OAuth session expired and could not be refreshed` |
| codex (`chrn_codex`) | created→failed | `in_progress`→`cancelled` | session match, prev echoed | ❌ `You've hit your usage limit … try again at Sep 16th, 2026` |

Protocol behavior is **identical across all three backends** — same event shapes,
same cancel semantics, same session continuation. The claude/codex turn failures are
user-account states on this machine, verified independent of the UHP layer by running
the CLIs directly:

- `claude -p "…" --output-format stream-json` → same OAuth error (machine-wide; needs
  the user's interactive `claude` re-login; no `ANTHROPIC_API_KEY` in env).
- `codex exec "…" --json` → same usage-limit error (account limit until 2026-09-16;
  no `OPENAI_API_KEY` in env).

Per §2.6 the UHP layer owns no keys, so these are not fixable from this layer.
Re-running Gate 2 after the user re-auths claude / the codex limit resets is a
one-command repeat (`/tmp/uhp-gate2.sh` shape; see gate2 transcripts).

### Gate 3: HR pytest oracle — **advisory report**

The upstream pytest suites are **in-process unit tests of upstream Python code** —
neither `runner/tests/` nor `gateway/tests/` takes a server URL (the over-HTTP oracle
is uhp-conformance, Gate 1). What was run, from `vendor/harnessrouter-ce/runner/`
(venv + pytest/pyyaml/fastapi/httpx):

```bash
/tmp/uhp-venv/bin/python -m pytest tests/ -q
# 268 passed, 1 skipped in 7.83s   (full runner suite — upstream oracle baseline)
/tmp/uhp-venv/bin/python -m pytest tests/test_token_usage_norm.py tests/test_codex_items.py \
  tests/test_codex_reasoning_strip.py tests/test_codex_sandbox.py \
  tests/test_codex_appserver_thread.py tests/test_claude_error_filter.py \
  tests/test_claude_base_url.py tests/test_claude_plugins.py -q
# 47 passed   (claude+codex backend subset; there is NO upstream kimi backend/tests)
```

Evidence: `hr-pytest-runner-full.txt`, `hr-pytest-backend-subset.txt`.

Drift report (oracle assertion → our Rust port, advisory):

- **Token usage nets cached read out of input** (`test_token_usage_norm`, both
  app-server camelCase and exec snake_case): ported in `drivers::norm_usage` +
  per-driver parsers; pinned by `codex::tests::parses_turn_completed_*` and
  `claude::tests::parses_result_usage_with_cache_fields`. **No drift.**
- **Codex item kinds read the same in both spellings; messages/reasoning are never
  tools** (`test_codex_items`): our codex parser maps `item`/`item.completed`/
  `item.started` and drops `reasoning`/tool items from assistant text
  (`codex::tests::parses_agent_message_and_drops_reasoning`). **No drift** on text;
  tool-call rendering into UHP output items is **not implemented** (see stubs).
- **Codex reasoning strip on resume** (`test_codex_reasoning_strip`,
  `_sanitize_codex_rollout`): upstream strips account-bound `encrypted_content` and
  provider item ids when the account fingerprint changes. Our resume is
  `codex exec resume --last` in a per-session cwd with the user's own CODEX_HOME —
  single-account, so the strip case cannot arise. **Deliberately not ported**
  (matches spec Binding 6: port per-backend logic, drop hosted-coupling cases).
- **Claude error filter / base_url / plugins** (`test_claude_*`): provider-env
  handling (bedrock/vertex/tokenrouter base URLs, plugin dirs) is upstream's
  multi-tenant provider matrix. We inherit the user's native authed CLI config
  (§2.6 mode a) and pass no provider env. **Not ported by design.**
- **kimi**: no upstream backend or tests exist (inventory gotcha #1); our driver is
  validated against the conformance suite (Gate 1) and live CLI 0.42.0 output.
- `gateway/tests/` (44 files): **not run** — collection needs the upstream hosted
  stack (redis et al., 40/49 collection errors on missing modules) and the suite
  exercises upstream's FastAPI app internals, not a network surface. Advisory-only
  at P6a per Binding 4.

## Test/build status

```bash
cargo test -p uhp-gateway     # 32 passed; 0 failed  (protocol, store, turn, 3 drivers, lib)
cargo build -p herdr --bin ao # green (29 pre-existing warnings, 0 errors)
cargo test -p herdr           # full suite: flaky failure cluster in
                              # config::io / detect::manifest(_update) / plugins tests
                              # (16 failures run 1, 9 failures run 2, overlapping but
                              # different sets — env/parallelism interference; ALL of
                              # them pass in isolation: config::io 20/20, detect:: 111/111).
                              # Pre-existing: the P6a herdr diff is additive only
                              # (serve.rs + one cli.rs match arm + help lines + path dep)
                              # and touches none of those modules.
```

## Stubbed / not done (honest list)

1. **claude + codex drivers never ran a successful live turn** — only failure paths
   (auth/limit) were exercised. Their parsers are unit-tested and their CLIs' wire
   formats match the vendored inventory, but a green live turn per backend is
   outstanding pending credentials. kimi is the only fully proven backend.
2. **Tool-call output items**: UHP `output` carries a single assistant `message`
   item with accumulated text. Tool use/result blocks (claude `tool_use`, codex
   command executions) are parsed but not rendered as UHP items.
3. **kimi usage is always null** — kimi CLI 0.42.0 `--output-format stream-json`
   emits no usage event. Allowed by T-05 (`usage` null, never fabricated).
4. **Extended/full class**: files input/output, session files/archive, containers,
   session sharing are not implemented; discovery honestly reports
   `files_input/files_output/session_sharing: false` and class `core`
   (`session_listing`/`harness_management` are true and implemented).
5. **Codex model override** writes an isolated `CODEX_HOME` with
   `model_provider="openai"` (per the inventory's namespaced-provider note) —
   compile-verified only; live path blocked by the same usage limit.
6. **No CI job yet** — the conformance pin + boot-`ao serve`-and-run CI workflow
   (Binding 3) is not wired; the gates above were run locally. The conformance CLI
   is not on PyPI; CI must install it from `vendor/harnessrouter-ce/protocol/conformance`.
7. `ao serve stop` as a separate verb does not exist — the surface is a foreground
   process stopped by signal (documented in `ao serve --help`).
8. `usage.input_tokens` for claude exec is fresh-only (cache subtracted); total =
   fresh input + output, matching upstream billing semantics.

## Credential model (§2.6) conformance

UHP owns no keys and has no key-storage UI. Mode (a) native authed CLI runtimes is
what shipped: drivers spawn `kimi`/`claude`/`codex` inheriting the user's own CLI
auth, per-session cwd isolation only. Mode (b) Allternit-cloud credentials via the
existing `cmd/allternit-api/src/llm_gateway/` BYO machinery is a reference the
drivers can resolve later — no code in this crate touches keys.

## P6b pointers

- Per-driver PRs: gemini, qwen, opencode, cline, pi, dsh (runner `BACKENDS` map).
- Conformance class extended → full as files/sharing land.
- CI conformance job + advisory pytest job (vendor-path install).
- Re-run Gate 2 for claude/codex once credentials are live; promote from red.
