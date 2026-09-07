# Session attestation — 0f55144a (model-lab live telemetry + HF catalog)

- **Date:** 2026-09-07 (0804)
- **Session:** `session/0f55144a` (kimi), worktree `allternit-session-0f55144a`
- **Merged to main:** PR #105, merge commit `84b95f8ae`
- **Branch commits:** `159634df1` (local-engine), `7cd74866d` (desktop), `6df7b2dd7` (model-lab UI + proxy + sidecar)

## What was done

Owner-requested: fix Model Lab telemetry, make the catalog pull live from Hugging Face, and solve preview-card rendering. Approved plan first; two parallel coder agents implemented (Part 1 desktop/engine, Parts 2+3 catalog/cards), parent verified the combined state.

### Root cause of the telemetry outage
The Model Lab reads machine telemetry from the Rust local-engine controller (`services/local-engine`, port 3015) via the allternit-api proxy. UI, proxy, and engine code all worked — but the desktop app **never started the engine and never shipped its binary** (zero references in `surfaces/allternit-desktop/src`). Every `/api/local-engine/status` returned 502 `local_engine_unavailable`.

### Part 1 — desktop owns the local-engine lifecycle (7cd74866d)
- New `surfaces/allternit-desktop/src/main/local-engine-manager.ts` — `LocalEngineManager` modeled on `BackendManager`: binary resolution (packaged `resources/bin/allternit-local-engine[.exe]`; dev `target/{debug,release}/local-engine`, then `resources/bin`, then `cargo run` fallback), health-reuse on 200 `/health`, lsof SIGTERM for port squatters, crash respawn with capped backoff [1s…30s] + jitter + stable-run reset + intentional-stop, 20s health wait, `stop()`/`getUrl()`/`getStatus()`.
- `unified-main.ts`: engine starts at Step 1.7 immediately before `backendManager.ensureBackend`, `LOCAL_ENGINE_URL` passed via `extraEnv`; failure is caught and non-fatal (same posture as office engine/ACU). `stop()` on `before-quit`.
- Packaging: `scripts/stage-local-engine-binary.cjs`, required entry in `verify-packaged-resources.cjs` (own `ALLTERNIT_ALLOW_MISSING_LOCAL_ENGINE=1` escape), `build-desktop.sh` builds+stages it, `prepare-platform-static.cjs` logs its presence, `package.json` `stage:local-engine` script. `extraResources` already copies `resources/bin/` wholesale.
- Naming note: the crate's `[[bin]]` is `local-engine`; staging normalizes the packaged copy to `allternit-local-engine` and the manager checks both.
- Live telemetry (`159634df1`): new `services/local-engine/src/sampler.rs` — `SystemSampler` owning one `sysinfo::System` (0.30 API), tokio task refreshing CPU+memory every 2s into `Arc<Mutex<SystemSample>>`, seeded after 500ms so first reads aren't 0. `/status` gains top-level `cpu_usage_percent: f32`; `ram.used_bytes`/`used_mb` are now live instead of snapshot-at-request. Everything else (disks, GPU via system_profiler/nvidia-smi, CPU model/cores) unchanged; response shape is additive-only.

### Part 2 — live Hugging Face catalog (159634df1, 6df7b2dd7)
- `services/local-engine/src/catalog/mod.rs`: `STALE_AFTER` = 30 min, `refreshing: Arc<AtomicBool>` CAS in-flight guard, `fetched_at()`/`is_stale()`/`spawn_refresh_if_stale()`; `refresh()` refactored to `refresh_locked()` so failures return before touching the cache — last-good-cache is preserved offline. Background 24h refresh unchanged.
- `GET /catalog`: stale-while-revalidate — spawns background refresh when stale, serves current cache immediately; response gains `fetched_at` (epoch secs, omitted when never polled) and `stale: bool`; models array shape unchanged. `POST /catalog/refresh` still forces a synchronous refresh (waits up to 60s on an in-flight SWR refresh instead of double-polling).
- `CatalogPanel.tsx`: empty search now loads `getCatalog('all', 50)` and renders it (trending GGUF without typing); typing switches to the existing live gizzi-code search. "Live from Hugging Face" (green) / "Cached (offline)" (amber) badge with relative age + `refreshCatalog()` button.

### Part 3 — preview-card rendering (6df7b2dd7)
- **Batch assess**: `POST /assess/batch` in the engine (`{"models":[...]}` → `{"results":[...]}` in request order, cap 50 → 400, per-index validation errors), auth-guarded proxy route `/api/local-engine/assess/batch` in `local_engine_routes.rs`, client `assessModelsBatch()`. `CatalogPanel` fires ONE batch call per visible result set (gated on `engineStatus`) instead of N parallel per-card POSTs; on failure falls back to client-side `computeHardwareFit`.
- **Honest fallback**: `computeHardwareFit` returns `fit: 'unknown'` → neutral gray "Fit unknown" badge when hardware memory is undetected, instead of the lying red "Too big".
- **Avatars**: new shared `AuthorAvatar.tsx` — HF avatar → deterministic monogram tile (first letter, HSL from author-name hash, muted dark range) → cube icon. Used in cards and `ModelDetailDrawer` (dead `onError → display:none` removed).
- **Real sizes**: HF list API returns no file sizes (verified by curl, with and without `blobs=true`); the gizzi-code sidecar (`cmd/gizzi-code/src/runtime/sidecar/index.ts`) now runs `attachGgufSizes()` — bounded detail fetch `GET /api/models/{id}?blobs=true`, max 12 models, `Promise.allSettled`, 6s shared budget, summing `siblings[].size` for `*.gguf` files; `sizeBytes` optional on `HuggingFaceModel`. Any failure leaves it undefined (name-regex estimate stays as last-resort fallback). Bug found in verification: `encodeURIComponent` on the repo id encodes the slash → HF 400; fixed by encoding per path segment.

## How it works (architecture notes)
- No new Electron IPC: the engine speaks HTTP through the existing allternit-api proxy (`LOCAL_ENGINE_URL`, default `http://127.0.0.1:3015`); the desktop only owns the process lifecycle.
- Catalog freshness is engine-side, not UI-side — the UI just renders `fetched_at`/`stale`.
- `sizeBytes` spans ALL GGUF variants in a repo, so multi-quant repos overstate a single-file download — accepted trade-off documented in code.

## Verification evidence
- `cargo fmt --check` / `cargo test -p allternit-local-engine` (9 passed, incl. new `staleness_tracking`) / `cargo check -p allternit-api` ✅
- Live engine smoke: `/status` on this M1 Pro → `cpu_usage_percent` 27–48% across reads, live RAM, GPU via system_profiler ✅; `/catalog` → 45 HF models, `stale:false`, second request 36 ms ✅; `/assess/batch` 2 models → fits/tok-per-s in request order ✅; error paths (51 models, empty array, bad repo_id) ✅
- `pnpm typecheck` desktop ✅ + `pnpm test` (115 passed) ✅ · web surface `pnpm typecheck` ✅ · gizzi-code `bun run typecheck` (2 errors, both pre-existing in `test/commands/slash-menu.test.ts`, committed in df9ed4c3c, unrelated) ✅

## Incidents / notes
- One agent accidentally ran workspace-wide `cargo fmt` (556 .rs files); detected via mtime + token-delta analysis and fully reverted (every diff provably formatting-only). Lesson recorded: `cargo fmt -p <crate>` only.
- Concurrent-agent coordination: agent 2 fixed a sysinfo-0.30 API call in agent 1's `sampler.rs` (`global_cpu_info().cpu_usage()`); no file conflicts (disjoint file sets by instruction).
- Whole-crate `cargo fmt` applied to `allternit-local-engine` (~15 files format-only churn beyond the 4 substantively edited) — the crate was failing `rustfmt --check` at HEAD.

## Unfinished / deferred (honest status)
- **Full desktop GUI boot test not run** — verification was engine/API/typecheck level plus curl smoke. Owner should boot the desktop app and eyeball the Engine tab + Catalog tab.
- Windows/Linux `allternit-local-engine` binaries come from CI, same as the API binary; only macOS local staging is covered by the new script.
- Multi-quant repo size overstatement (see architecture notes).
- Dev-port note (pre-existing): desktop dev UI expects `localhost:3014`, web surface Vite defaults to 3013 — align via env when running the dev UI.
