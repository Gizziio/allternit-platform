# Craft video kind — app-independent parts (registry + FilmCraft bundle)

Session: `session/craft-video-kind-20261010` · Agent: kimi-code (delegated worker) · 2026-10-10
Merged: platform **#1480** (`dd745c67b1`) + ai **#500** (`b274d3ad7`) · Eoj-approved merges.

## What landed
- `video` artifact kind registry entries: `cmd/allternit-cloud-api/src/artifacts/kinds.rs`
  (kind `video`, `application/vnd.allternit.video+json`, allow-list) + `allternit-ai/src/lib/artifacts/kinds.ts`
  (mirror). Both sides mirror the image/pdf entries exactly.
- Clean **FilmCraft** bundle rebuild per `vendor/craft/VENDOR.md`: `CRAFT_FEATURES=embed cargo xtask web`
  (release, craft-host compiled). The previously served bundle was built by an orphaned session
  process; this replaces it. `strings filmcraft_web_bg.wasm | grep craft:1` → 7 matches
  (incl. the embed-mode control-surface notice). 0 files ≥ 25 MiB (wasm 23,105,322 B). Byte-verified
  (`cmp`) copy at `surfaces/office.allternit.com/public/craft/video/`, index.html cache-bust hash regenerated.
- `vendor/craft/VENDOR.md`: documents that `video/xtask/src/main.rs:281` forwards `CRAFT_FEATURES` to
  cargo `--features` and that future craft CI must set `CRAFT_FEATURES=embed` (no craft CI exists yet).
- Fix-it-now along the way: `dependency-map --validate` was red on main since #1477 (features.json
  `touches` used `src/routes/artifact_runtime.rs`; split-crate components are `src/routes/artifact_*`)
  — fixed; video decision recorded. Doc gaps closed: `docs/design/artifacts-v2.md` +
  `surfaces/docs/api/artifacts-v2.mdx` kind tables were missing the `pdf` row since 2026-10-10 —
  added pdf + video rows and updated prose lists (only what is true today).

## Verification
- `cargo check -p allternit-cloud-api` ✅ (pre-existing warnings only); kinds tests 5/5 ✅
  incl. the contract list with `video`.
- ai: `pnpm install --ignore-scripts` ✅, `pnpm typecheck` (tsc --noEmit) exit 0 ✅,
  vitest registry + api-store + craft suites 57/57 ✅, `check-sw-cache-bump.mjs` →
  "No Fabric Session asset changes." ✅, `check_links.py` 0 problems (525 nav / 520 pages) ✅.
- Dependency-map impact: kinds.rs → Cloud API; Dashboards/Artifacts/Motion/Craft editors; all four
  surfaces; 288 components. kinds.ts → ai.allternit.com + Desktop; 280 components.
- Storage gate: NO change needed — `runtime.rs:187` admits `image`/`video` storage-only with test
  `craft_editor_kinds_store_sources_but_never_run_apps` (came with #1477; re-confirmed).
- wasm-opt v133: NO patch needed — the xtask's existing flag set sufficed.

## Incidents / lessons
- Premise corrected mid-flight: allternit-ai has NO `public/craft/` mirror (never did); the app embeds
  cross-origin from `office.allternit.com/craft/` (`CRAFT_BASE`, `src/components/craft/bridge.ts:41`).
  VENDOR.md's stale "mirrored into allternit-ai" line corrected. Mirror step dropped from scope.
- `gizzi workspace node add|claim|close` all fail with yargs "unexpected argument" (gizzi 2.1.9);
  plan `dag_724767` was created but node tracking was impossible — tracked via checkpoint instead.
  Tooling issue worth a fix.
- After merge, office.allternit.com auto-deployed the new bundle (Pages Git integration,
  deployment `90bf32f9` @ `dd745c6`); live wasm size verified == rebuilt size.

## Deferred (honest)
- **Video host wiring** (the rest of the ~2-session item): footage via media-plane refs in meta
  (never the 20 MB text budget), OPFS buffers, `media_generate` outputs become video-kind,
  phone v1 = view + trim (flag Eoj). Until then nothing creates video-kind records; both merges
  are user-inert (project JSON renders as text fallback).
- Agent co-editing (`studio` pane executor + `studio_command`), Phase-4 cleanup, README screenshot
  regen — per handoff order, next slices.
- Lifecycle: Desktop rebuild skipped (joe-07 owns Desktop; this slice doesn't change desktop-bundled
  runtime code beyond the already-auto-deployed UI). Shared-checkout main sync blocked by other
  sessions' dirty files (documented in HANDOFF-craft-editors-2026-10-10.md) — expected, not fixed.
- Same-night deploy session (separate attestation-worthy work, recorded in
  `Allternit Brain/Infra/deploy-runbook.md`): cloud-api manual deploy to Contabo at `5cc7ffa50d`
  with migrations 085–087; PWA manual deploy at `5d26d443`; ai/office confirmed auto-deploying.
