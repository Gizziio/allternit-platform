# Session attestation — artphase3-0912 — A:// Artifacts Phase 3: publish tiers

- **Date:** 2026-09-12 (~13:55 local)
- **Session:** `artphase3-0912`, worktree `allternit-session-artphase3-0912`, branch `session/artphase3-0912`
- **Agent family:** Kimi (Kimi Code CLI)
- **Issue:** #389 — Artifacts API Phase 3: publish tiers
- **PR:** #426 — merge commit `8e5a50300` (merged with `--merge`)

## What was done

A:// Artifacts **Phase 3 — hosted publish** per `docs/design/artifacts-api.md`
§6 (all four Eoj decisions 2026-09-12 implemented):

1. **Shared Cloudflare Pages project with per-user routes** (not per-user
   projects). Deterministic per-user route prefix `u-<sha12(user_id)>`, stored
   idempotently in the new `content_artifact_publish_routes` table
   (INSERT OR IGNORE — the derivation always converges on the same row).
2. **Publish snapshots an immutable version.** `POST …/publish {version?}`
   records `published_version`; later version appends do NOT change what is
   live. Verified by test and live smoke (append v2 after publish → status
   still v1 → deployed index.html still v1).
3. **Deployments stay immutable.** `DELETE …/publish` removes the route only.
   Verified on disk: route directory removed, deployment file intact.
4. **Publish is gated on sandbox_policy.** Any policy whose name carries
   `network` (case-insensitive) is rejected at publish with 422 and an error
   naming the policy. v1 ships only `standard`, so the gate is a matcher over
   the policy string — a data decision, not a code change, when new policies
   land.

Gateway: new `cmd/allternit-api/src/content_artifact_publish.rs` —
`POST/GET/DELETE /api/v1/content-artifacts/:id/publish`, mounted in `main.rs`
next to the Phase 1 router; V150 migration (`content_artifact_publishes`
publish state + history with `unpublished_at`, plus the route map). Idempotent
republish: same version already live → 200 replay with no redeploy; new
version → 201 with a new deployment. Phase 1 helpers in
`content_artifact_routes.rs` widened to `pub(crate)` (no behavior change);
its test module is now `pub(crate)` so the publish tests reuse the same
`AppState` fixture.

Deploy plumbing: narrow `ArtifactPublisher` trait, env-selected via
`ALLTERNIT_ARTIFACT_PUBLISHER`:

- `wrangler` — real `npx wrangler pages deploy` against the shared project
  (`ALLTERNIT_ARTIFACT_PAGES_PROJECT`, default `allternit-artifacts`).
  Unpublish redeploys the staging tree without the route; the previous
  deployment keeps its own immutable `pages.dev` URL (wrangler CLI cannot
  delete individual deployments — this is the honest mapping of decision 3).
- `fs` (default; Cloudflare creds aren't reachable from every dev machine) —
  real servable static-site trees under `<data_dir>/artifact-publish/`:
  immutable `deployments/<id>/index.html` + `routes/<user_prefix>/<artifact_id>/index.html`
  (symlink on unix). Same layout the shared project uses. Not a fake deploy.

Static export: full HTML documents pass through; fragments get a minimal
standards-mode shell (`<!DOCTYPE html>` + title + viewport).

Web surface (presentational only; sibling-owned `content-artifact-sync.ts` /
`gallery-store.ts` / `project-file-store.ts` untouched): publish/unpublish/
status client fns appended to `content-artifact-api.ts`; new
`GalleryPublishActions.tsx` row under each gallery card in
`NewProjectScreen` (resolves the gateway artifact id from the entry, degrades
silently when the gateway is unreachable, shows a plain message on a
sandbox-gate 422); small CSS block in `new-project-screen.css`.

Design doc: §3 publish API appended, §6 hosted-publish tier row marked
IMPLEMENTED with the actual routes, §7 Phase 3 marked implemented.

## Verification evidence

- `cargo test -p allternit-api content_artifact` — **14/14** (7 new: gate
  rejection, snapshot pinned after append, unpublish-keeps-deployment on
  disk, idempotent same-version republish + new-version redeploy,
  missing-version 400, user scoping, fs publisher direct lifecycle).
- Full `cargo test -p allternit-api` — **1007 passed, 7 failed, none mine**:
  4x `agent_cloud … provision_*` + `rails::gate_data_plane_round_trip`
  (known pre-existing per PR #411) and `aci_routes …
  audit_api_returns_rows_with_bot_filter` + `deployment_scheduler …
  overdue_catch_up_fires_once_not_a_burst` — both **pass in isolation**;
  audit-row-count and timing assertions, order/timing flakes. This diff
  touches no aci/deployment-scheduler code.
- `cargo build --release -p allternit-api` — green (13m17s); release binary
  contains the `content-artifacts/:id/publish` route string and the gate
  message.
- Live smoke from the worktree gateway (debug binary, fs publisher,
  `ALLTERNIT_LOCAL_DEV_BYPASS=true`, port 18013, scratch data dir):
  create → publish 201 (`routePath u-b544b0406548/art_…`) → status →
  append v2 → status still v1 → deployed index.html still v1 → unpublish →
  route dir gone + deployment file intact → gated artifact → 422
  `publish rejected: sandbox_policy 'allow-network' requests network access …`.
- `tsc --noEmit` (surfaces/ai.allternit.com) — 0 errors.
- Full design vitest — **225 files, 1770 passed, 0 failed** (1 file skipped).
- `node scripts/release-preflight.mjs` — **35 passed, 0 failed**.

## Incidents / notes

- First `cargo test` background run died at the 300s cap mid-compile;
  re-ran with a longer timeout — no code issue.
- Merge of origin/main before the PR conflicted only in
  `.steering/checkpoint.md` (sibling's relay-watchdog checkpoint); resolved
  keeping both, theirs first.
- The shared checkout `allternit/` is on branch `ao/platform-console-agents`
  with another session's uncommitted `fabric_routes.rs` change — left
  untouched; the ritual's shared-checkout `git pull --ff-only` was skipped
  and the ledger was committed from a dedicated worktree on origin/main
  instead (same result: attestation lands on main via its own PR).

## Honest deferrals

- The wrangler publisher is real but unexercised in CI (no Cloudflare creds
  there); it is env-gated and off by default. First real deploy against the
  shared project still needs a human-run smoke with credentials.
- Wrangler unpublish semantics (redeploy-minus-route; old deployment URL
  stays live) are documented in code, design doc §3, PR #426, and here.
- Static-export polish (`artifact-export.ts`) intentionally untouched —
  stays client-side per §7.
- Org relay tier remains decided-but-unscheduled (§6 relay answers).
