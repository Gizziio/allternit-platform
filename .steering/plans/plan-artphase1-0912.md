# Plan — Artifacts API Phase 1 (session artphase1-0912)

Goal: Land Artifacts API Phase 1 per docs/design/artifacts-api.md §7 — gateway CRUD + design-session persistence. Version retention decided (cap 50, admin-configurable, prune oldest) — implement at version-append time.

## Todos

- [ ] Scope code: read artifact_routes.rs (pattern), main.rs mount, migrations dir, gallery-store.ts, design save plumbing (DesignModeView upsert path), gallery read path
- [ ] V146 migration: `content_artifacts`, `content_artifact_versions`, `content_artifact_idempotency` tables + indexes
- [ ] `content_artifact_routes.rs`: create (201 + v1) / read / list (type/project/q/limit/cursor) / PUT versions (append) / PATCH (convenience) / versions list / version read / soft DELETE / idempotency (header + body key, (user_id,key), 24h TTL, repeat create → 200 original)
- [ ] Version retention: cap default 50, env/config override, prune oldest beyond cap at append time
- [ ] Storage: inline ≤256KB, file storage under `<data_dir>/content-artifacts/<id>/<version>.<ext>` beyond that (§4)
- [ ] Mount in main.rs following artifact_router() merge pattern, inside protected /api/v1 nest
- [ ] cargo test -p allternit-api (new route tests incl. idempotency + retention cap)
- [ ] cargo build --release -p allternit-api
- [ ] Web surface: design save path writes through API (IndexedDB kept as offline fallback); gallery reads gateway-first with IndexedDB fallback. Touch ONLY design save/gallery plumbing — NOT ArtifactRenderer.tsx, NOT DESIGN.md §11
- [ ] pnpm typecheck in surfaces/ai.allternit.com (0 errors)
- [ ] pnpm vitest run src/lib/design green
- [ ] Live smoke: start gateway from worktree, curl create→read→append→list→delete
- [ ] node scripts/release-preflight.mjs (35/0)
- [ ] Conventional commits, push, gh pr create (real summary + evidence), gh pr merge --merge
- [ ] Comment on issue 387 + close when merged
- [ ] Ledger: session/ledger-artphase1-0912 branch, summary + LEDGER.md line, PR + merge
- [ ] Desktop rebuild: copy sidecars, npm run dist background, bundle-verify grep "content-artifacts", preserve 8-file set, retire previous latest only
- [ ] Cleanup: worktree remove, delete session + ledger branches local+remote, final sweep
