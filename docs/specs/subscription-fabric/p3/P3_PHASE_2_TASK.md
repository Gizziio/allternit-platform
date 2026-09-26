# P3 Phase 2 Task — chatgpt-web adapter + allternit CLI subcommands

You are building Phase 2 of 3 of P3: the first real adapter (`chatgpt-web`) and the CLI surface. Phase 1 (worker layer + artifact store) is complete and reviewed. Contracts, SDK, and gateway are all merged. **Do not rewrite Phase 1 files** — genuine defects: minimal fix + `deviations`.

## Normative sources (read first)

- `docs/specs/subscription-fabric/IMPLEMENTATION_PLAN.md` — **P3 scope + manual gate (lines 152–157)**, adapter layout lines 103–105, CLI line 122–126
- `docs/specs/subscription-fabric/REVIEW_CLAUDE.md` — §A1 (adapter interface), §A3.3 (declarative base + code hooks for artifact capabilities), §A5 (real Chrome channel, headful default, pacing, provider-side hygiene), §A6.5/6 (navlock, quarantine)
- `docs/specs/subscription-fabric/HARDENING.md` — **D5 (line 23: temp-chat default for stateless ChatGPT bot tasks)**, D6 (line 24: this adapter becomes the ONE automation identity — media-router migration is NOT in this phase), profile-ownership fix #6 (line 39: SingletonLock → `profile_locked`), D11 (progress extractors via `progress:` selector group)
- SDK `@allternit/subscription-adapter-sdk` — `DeclarativeChatAdapter` handles chat; you extend it with image hooks. Its conformance runner must pass on your fixtures.

## Important: provider naming

The no-provider-literals rule applied to contracts/SDK/gateway-core. This adapter IS the ChatGPT adapter — `chatgpt-web` naming and chatgpt.com origins are correct and expected here. Keep literals inside `adapters/chatgpt-web/` and its tests only.

## Exact deliverables

1. `services/subscription-gateway/adapters/chatgpt-web/manifest.yaml` — §S2 shape (parse into the contracts `AdapterManifest` at load): `adapter_id: chatgpt-web`, `interface: ui_bridge_web`, origins `["https://chatgpt.com", "https://auth.openai.com"]` + CDN hosts as needed (document each), auth `{ login_url, logged_in_probe }`, plans (`free`, `plus`, `pro` as PlanDefs), capabilities:
   - `chat.create` (pool `chat-msgs`, detachable false, export_formats [])
   - `chat.continue` (requires_thread, same pool)
   - `image.generate` (pool `image-gen`, detachable true — provider renders server-side)
   pacing profile (§A5 shape; conservative: min_action_gap_ms [1200, 3500], min_task_gap_s 8, max_tasks_per_hour 30, max_tasks_per_day 150), `selectors_version: v1`.
2. `services/subscription-gateway/adapters/chatgpt-web/selectors/v1.yaml` — §A3.2 shape (named keys, `critical:` flags, ordered strategies semantic-first): `composer`, `send_button`, `stop_button`, `response`, `streaming`, `logged_in_probe`, `temp_chat_toggle`, `model_picker`, `image_result`, plus a `progress:` group (step list, counter badge) and `capability:` entry points (`image_tool_toggle`). NOTE: you cannot verify live selectors without a logged-in session (Phase 3 manual gate) — write best-effort selectors from public knowledge of the ChatGPT web UI, mark them clearly as `v1-unverified` in a comment, and make the conformance fixtures match THESE selectors so the suite is meaningful.
3. `services/subscription-gateway/adapters/chatgpt-web/adapter.ts` — extends the SDK `DeclarativeChatAdapter`:
   - `chat.create`: temp-chat mode ON by default for stateless tasks (D5; manifest-configurable per account), then the declarative flow
   - `chat.continue`: requires `thread_id` → navigates the provider thread URL, runs the divergence check (`readThread`: last turn fingerprint vs `thread_mappings`) before submitting — mismatch → `on_divergence` policy from the mapping (adopt/fork/fail)
   - `image.generate`: drives the same composer with the image entry point, captures results via SDK `captureImages` → `artifact.ready` (+`artifact.partial` as tiles stream, D11)
   - `reconcile`: after crash — locate the provider thread (URL on the attempt), compare `prompt_fingerprint` against the last user turn; match → `acknowledged` (adopt), no match but thread exists → `ambiguous`, thread gone → `not_found`. **Never resubmits.**
   - `probe`: declarative probe + image entry-point locator (§A3.4)
   - challenge/login wall → `needs_user` (never retried, Critical #5); SingletonLock profile → `profile_locked` (fix #6)
4. `services/subscription-gateway/adapters/chatgpt-web/fixtures/` — hand-written HTML in the same 6-state + progress style as the SDK fixtures but shaped like the ChatGPT web UI AS DECLARED IN selectors/v1.yaml: `logged-out.html`, `idle.html`, `streaming.html`, `complete.html`, `limit-banner.html`, `challenge.html`, `image-mid-run.html` (partial image tiles), `research-mid-run.html` (if the progress group supports it).
5. `services/subscription-gateway/adapters/chatgpt-web/README.md` — 30 lines max: what it covers, temp-chat default, the manual-gate steps for a human (connect → login → task run → kill -9 reconcile check), and the v1-unverified selectors caveat.
6. `services/subscription-gateway/test/chatgpt-web-conformance.test.ts` — run the SDK conformance runner against the adapter + fixtures (all states) + a divergence-check unit test (fingerprint match/mismatch) + reconcile outcome mapping (match/no-match/gone).
7. `cmd/cli` — add the fabric subcommands (commander, match the existing CLI's style): a tiny UDS/HTTP client (`src/subs/client.ts` — socket path from `SUBS_GATEWAY_STATE_DIR` or default `~/.allternit/subscriptions/gateway.sock`; token resolution: `SUBS_GATEWAY_TOKEN` env → macOS `security find-generic-password -s com.allternit.subscription-gateway -a cli-token -w` → clear error):
   - `allternit subs list` / `subs status` (GET /v1/accounts + status), `subs connect <provider>` (POST /v1/accounts — prints the "log in in the window" instruction; the visible window itself is the worker's job), `subs disconnect <id>`
   - `allternit caps list [--provider]` (GET /v1/capabilities)
   - `allternit task run <capability> [--provider auto] [--prompt ...] [--wait]` (POST /v1/tasks; `--wait` follows GET /v1/tasks/{id}/events SSE and prints progress/reply/done lines, acking via /v1/events/ack)
   - `allternit artifacts list` / `artifacts open <id>` (list from the gateway; `open` prints the quarantined path and requires an explicit `--i-know-its-quarantined` flag before shelling out to `open` — §A6.6)
   - also: small gateway addition — at boot, if no `cli` caller token exists, issue one and store it in the keychain under account `cli-token` (this is how the CLI authenticates; document in the gateway README).
8. Gateway adapter loading — a minimal registry: `src/adapters/registry.ts` loads `adapters/*/manifest.yaml` at boot, validates against the contracts manifest schema, and exposes them to `GET /v1/capabilities` (which now returns the live registry view instead of `[]`) and to the worker factory. Static router stays no-route (P4).

## Hard gates

- `pnpm -F subscription-gateway build` and `test` PASS (all prior tests stay green); `pnpm -F @allternit/cli build` PASS.
- chatgpt-web conformance passes against its fixtures; conformance negative control still fails loudly (run the SDK's broken-pack test — must stay green).
- No git operations. Live provider contact is FORBIDDEN in this phase — everything runs against fixtures. The manual gate is Phase 3 with the human.

## Completion sentinel

Write `docs/specs/subscription-fabric/p3/P3_PHASE_2_NOTES.md` with YAML frontmatter (`status`, `files_changed`, `deviations`, `remaining`, `verify`) then prose. That file existing = done.
