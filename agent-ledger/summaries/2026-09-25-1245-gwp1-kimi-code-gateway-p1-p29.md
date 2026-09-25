# Session attestation — gwp1 (Kimi Code) — gateway P1/P2.9 + gizzi retry_hint consumer

- **Branch:** `session/gwp1` → **PR #732**, merged (merge commit) `5176d3478` into `main` on 2026-09-25.
- **Predecessor:** session/gwrobust (PR #728, P0s) — this session ships every remaining actionable item from `Allternit Brain/Products/GatewayGapAnalysis.md`: P1.5–P1.8, P2.9, and the gizzi-side half of P0.2. Brain doc updated same day: grade B → A- (brain vault commit `ebd63fc`).
- **DAG:** `dag_729753` (7 nodes; all closed DONE by end of session).

## What was done

- **gizzi-code consumes `allternit.retry_hint`** (`src/runtime/providers/retry-hint.ts` new; `provider.ts`, `session/processor.ts`, `session/trace.ts`): SSE-frame-aware TransformStream in the provider custom fetch strips the hint frame (the AI SDK parser would choke on the unknown named event) and records it per session; on stream error, `processor.ts` consumes the hint (take-once) and re-drives once per request, cloning the model id as `<provider_id>/<model_id>` when `next_fallback` is present. `retryable:false` or a second hint falls through to the existing SessionRetry path. Opt-out `GIZZI_DISABLE_RETRY_HINT`. Gated to POST */chat/completions SSE responses carrying `x-gizzi-session`.
- **P1.5 OTel** (`src/otel.rs`, `llm_gateway/genai_spans.rs`, main.rs, proxy.rs): workspace otel pins aligned to a consistent 0.22 set (0.20 pins were mutually incompatible with tracing-opentelemetry 0.23); custom OTLP/HTTP **JSON** exporter over opentelemetry-http (no opentelemetry-otlp in the pin set) with a reqwest-0.12 client shim. Off by default — `OTEL_EXPORTER_OTLP_ENDPOINT` opts in, `OTEL_SERVICE_NAME` overrides; static gate makes the default config byte-identical with zero span overhead. GenAI semconv attributes on the handler span + a span per retry attempt (attempt/provider/model/outcome/error.type).
- **P1.6 response cache** (`llm_gateway/response_cache.rs` new, proxy.rs, metrics.rs): opt-in (`LLM_RESPONSE_CACHE_TTL_SECS`, default 0=disabled; `LLM_RESPONSE_CACHE_MAX_ENTRIES` 1024). SHA-256 key over canonical JSON of output-affecting fields; non-streaming, tool-free, n=1 requests only; checked after auth/residency/DLP/allowlist, before gizzi session creation (a hit creates no session and no upstream call); hits carry `x-allternit-cache: hit` and record zero-cost usage through the same `record_usage_event` choke point. `llm_response_cache_hits/misses_total{model}` counters.
- **P1.7 org-scoped BYOK pool** (migration **V181** `org_route_credentials` + health columns on `user_route_credentials`; route_credentials.rs, proxy.rs, admin_routes.rs, main.rs): resolution user → org pool → platform; rotation picks least-recently-failed/least-recently-used with round-robin cursor; a credential is marked `failed` and skipped after 3 consecutive marks; background revalidation sweep (`ROUTE_CREDENTIAL_SWEEP_INTERVAL_SECS`, default 6h, 0=off) re-probes via the validate-before-store `/models` path — 401/403 → revoked, transient untouched; 60s hot-path decrypt cache (`ROUTE_CREDENTIAL_CACHE_TTL_SECS`) with explicit eviction; org-admin-gated CRUD at `/gateway/orgs/:org_id/route-credentials`.
- **P1.8 real tokenizers** (`estimation.rs`): reused the already-pinned `tiktoken-rs 0.12` — no new dep. cl100k_base (GPT-4/3.5 + unknown default) and o200k_base (gpt-4o/gpt-4.1/gpt-5/o1/o3/o4), `openai/`/`azure/` prefixes stripped; once_cell Lazy BPE cache; chars/4 heuristic only on tokenizer init failure. Public contract unchanged.
- **P2.9 shared state** (migration **V182** `gateway_cooldowns` + `gateway_rate_limit_buckets`; `llm_gateway/shared_state.rs` new, failover.rs, auth.rs, main.rs): SQLite (not Redis — the codebase is rusqlite/DbHandle; replicas sharing the file get shared state with zero new infra). Cooldown tracker writes through with 250ms L1 read cache; per-key/per-org RPM counters authoritative in fixed-window DB buckets with an in-memory denial cache; fail-open on any DB error (warn + atomic error counter; Prometheus export deliberately left for a follow-up to avoid a metrics.rs conflict with the cache work). `GATEWAY_SHARED_STATE=sqlite` opts in; default in-memory behavior byte-identical.
- **P2.10–12**: not built — each is trigger-gated (multi-human policy management, Fabric Runtime joining the backend set, admin-plane latency contention). Design seams recorded in `docs/specs/gateway-hardening/p2-design-seeds.md`.

## Verification evidence

- `cargo test -p allternit-api llm_gateway`: **262 passed, 0 failed** (combined tree, all features).
- `cargo test -p allternit-api --test wire_conformance`: **10/10** (no regressions).
- `cargo test -p allternit-api --lib otel` + genai_spans: 3+2 green, incl. OTLP payload serialization and span-attribute capture tests.
- gizzi-code: `bun test test/runtime/retry-hint.test.ts` **13/13** (wire shape, split-byte/CRLF framing, false-positive guard, take-once, gating, kill-switch).
- `cargo build -p allternit-api` clean; no new Rust deps beyond the otel pin alignment; no new TS deps; no pnpm-lock churn committed.
- Migrations V181/V182 verified against highest-existing-version rule (the V142-144 duplicate-version boot panic class; build.rs rerun-if-changed=migrations picks them up).

## Incidents / honest deferrals

- Concurrent subagents shared one worktree; two transient compile breaks from cross-agent in-flight edits were observed and resolved by sequencing/waiting — final combined tree verified green after all edits settled.
- OTel exporter not smoke-tested against a live collector (unit-tested serialization only) — worth a smoke run before enabling in production.
- gizzi-code `bun run typecheck` preflight is blocked by **pre-existing** `platform/packages/os-contracts` build errors (spine.ts TS2554); all touched TS files are individually tsc-clean, and the 4 `test/runtime` failures are pre-existing cross-file interference (reproduced with the new test file removed).
- Shared rate limiter is fixed-window (in-memory one is sliding) — up to ~2× admission across a window boundary; documented as acceptable for abuse steering.
- `shared_state::db_error_count()` is an atomic pending Prometheus export (metrics.rs was the other agent's surface).
- P0.4-fenced endpoints (embeddings/images/realtime) still have no real provider path — fencing is honest, but the features themselves remain unimplemented.
- The legacy Anthropic-shaped gizzi path is not hint-wired (gateway only exposes /v1/chat/completions).
