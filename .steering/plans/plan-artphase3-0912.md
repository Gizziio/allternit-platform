# Plan — artphase3-0912: A:// Artifacts publish tiers (issue #389, design §6/§7 Phase 3)

## Scope
Gateway publish/unpublish/status routes + deploy plumbing + minimal web surface
actions + design-doc publish sections. Sibling-owned files (content-artifact-sync.ts,
gallery-store.ts, project-file-store.ts, chat persist, cowork links, design §2.1) are
consume-only.

## Todos
- [ ] V150__content_artifact_publishes.sql — publish state (published_version,
      published_at, route, deployment id/url) + per-user route mapping table.
- [ ] cmd/allternit-api/src/content_artifact_publish.rs:
  - [ ] POST   /content-artifacts/:id/publish {version?} — sandbox-policy gate
        (reject network-requesting policies, clear 4xx naming the policy), immutable
        version snapshot, static export of version body, deploy via publisher.
  - [ ] DELETE /content-artifacts/:id/publish — unpublish = remove route only,
        deployment stays immutable.
  - [ ] GET    /content-artifacts/:id/publish — status.
  - [ ] Publisher trait: WranglerPagesPublisher (real `wrangler pages deploy`,
        env-selected) + FsPublisher (filesystem deploy with immutable deployments +
        removable routes, default for dev). Selected by ALLTERNIT_ARTIFACT_PUBLISHER.
  - [ ] Tests: gate rejection, snapshot semantics (append after publish doesn't
        change live), unpublish-keeps-deployment, idempotent republish, status.
- [ ] Mount router in main.rs (follow content_artifact_router merge).
- [ ] Web surface: publish/unpublish + status in artifact gallery card actions
      (presentational, consumes existing sync client patterns).
- [ ] Design doc: §3 publish API append, §6 publish tier rows → IMPLEMENTED,
      §7 Phase 3 status update.
- [ ] Verify: cargo test -p allternit-api (new tests green; known pre-existing
      failures not mine), cargo build --release -p allternit-api, live curl smoke
      with fs publisher, pnpm typecheck in surfaces/ai.allternit.com, design
      vitest, node scripts/release-preflight.mjs.
- [ ] Ritual: conventional commits, PR, merge --merge, ledger attestation,
      desktop rebuild, cleanup.

## Non-goals
- Static-export polish (client-side artifact-export.ts) unless it blocks publish.
- Org relay tier. Cloudflare creds availability — wrangler impl is real but
  env-gated; fs publisher is the dev default.
