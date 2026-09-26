# Session attestation — gwp2 (Kimi Code) — gateway P2.10–12 + one-build disk rule

- **Branch:** `session/gwp2` → **PR #734**, merged (merge commit) `27ae2e82d` into `main` on 2026-09-25.
- **Owner decision:** build the three trigger-gated P2 items from the gap analysis; triggers waived. `docs/specs/gateway-hardening/p2-design-seeds.md` updated from "not built" to shipped-status with implementation pointers.
- **DAG:** `dag_285739` (6 nodes).

## What was done

- **P2.10 declarative config round-trip** (`provider_routing.rs`, `admin_routes.rs`): `POST /gateway/provider-routing/import` accepts the exact Hermes YAML the export path emits (bare sections and JSON `{"yaml","apply"}` forms too). **Dry-run by default**: validate + structured `PolicyDiff` (flat keys + per-model overrides with added/changed/removed and old→new; unknown provider/models are warnings checked against the models.dev pricing catalog, suppressed when the catalog is absent). `?apply=1` commits in a single DB transaction; `dry_run+apply` together → 400. Scope-depth seam documented at provider_routing.rs:437-447 (org→project→workload = resolution-order change, not rewrite).
- **P2.11 native-mode sorting engine** (`provider_routing.rs`, wired in `proxy.rs` retry loop): `BackendKind{Proxied,Native}` (Native = documented stub for Fabric Runtime), `CandidateSignals` (cost from `llm_pricing::pricing_snapshot()`, cooldown flag, kind), `sort_candidates` — deterministic total order: healthy before cooling → cheaper combined rate first (unknown cost sorts LAST, never fabricated as 0) → native over proxied on exact tie → original position. `select_fallback_sorted` sorts then delegates to `failover::select_fallback_healthy_at`, so P0.1 health hard-filter and fail-open semantics are unchanged. The proxy retry loop (`proxy.rs`) now calls the sorted variant — production-active, not a stub.
- **P2.12 CP/DP split** (`control_plane.rs` new; main.rs, lib.rs): `ALLTERNIT_ROLE=data|control|all` (default `all` = byte-identical current behavior) + `ALLTERNIT_ADMIN_LISTEN_ADDR`. Control role serves the gateway admin plane standalone (health + Clerk-auth'd `/api/v1/gateway/*`, owns credential sweep + batch worker; defaults to `127.0.0.1:18099`); data role mounts no admin routes and runs no sweeps. Split-process pairing shares state through the same SQLite file — documented with a copy-paste example pairing `GATEWAY_SHARED_STATE=sqlite` (V182). Invalid role/addr fails loudly at boot.
- **AGENTS.md hard rule (owner-directed):** disk-hygiene commandment 4 rewritten — **exactly ONE built desktop version on disk at any time**: one verified DMG, one unpacked app bundle, current sidecar set. The moment a new bundle is verified, every older DMG/blockmap/app bundle is deleted in the same session regardless of which terminal built it. Rationale (owner): concurrent terminals keep rebuilding; lingering builds get run stale.

## Verification evidence

- `cargo test -p allternit-api llm_gateway`: **283 passed, 0 failed** (+21: import round-trip/diff/apply/malformed/conflicting-flags; sort cost/health/tiebreak/native/regression).
- `cargo test -p allternit-api --lib control_plane`: **12/12** (config parsing, boot gating, per-role router composition).
- `cargo test -p allternit-api --test wire_conformance`: **10/10** — no regressions.
- Live boot smoke by the implementing agent (scratch data dir, 18013/18099 only): role=control serves admin on 18099 with main port unbound; role=data drops admin routes; role=all+addr mounts admin on both listeners. Two test processes initially orphaned by a subshell-kill mistake were found via lsof and killed; port 8013 never touched.
- Pre-merge gate hook ran a full workspace build — green.
- `cargo build -p allternit-api` clean; no new dependencies.

## Honest deferrals

- Two-process CP/DP pairing documented and single-process-smoked, not CI-automated.
- Control-role processes still pay full AppState init cost (state separation deferred).
- Only the two gateway-owned background tasks are role-gated; fabric/desktop/routine loops run in all roles (full sweep-ownership audit = follow-up).
- `BackendKind::Native` has no real native backends until Fabric Runtime joins.
- Console UI for the import endpoint not built (API + tests only; the console editor already has resolve-preview/export).
