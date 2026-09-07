# Session attestation — P0 production-readiness gap analysis execution (b6d6153b)

**Agent:** Kimi Code (session b6d6153b) · **Date:** 2026-09-03 · **Branch:** `session/b6d6153b` (pushed)
**Source of truth:** `reports/2026-09-03-production-readiness-gap-analysis.md` (Execution Guide Steps 0–9)

## Outcome

All P0 steps except Step 6 (a reserved USER DECISION) are complete. Step 6 ask + the
secrets rotation list were delivered to the user in-session.

## Commits (oldest → newest, on top of origin/main @ 281ff4732)

| Commit | Step | What |
|---|---|---|
| `868192815` | 1 (B4) | Desktop merge ea89a5fdb repair: unified-main.ts dedup (state decls, HUD windows, effectiveMode restored, 4 dup `shell:*-hud` handlers — move-hud accepts both renderer shapes, close/toggle = hide semantics, show-hud added); preload dup closeHud/toggleHud keys removed. Verify: tsc 9→0 main / 2→0 preload, vitest 94/94, build green. |
| `7e96841d2` | 3 (B7) | Vendored `allternit-cloud-contracts` at `platform/protocols/allternit-cloud-contracts` (+VENDORED.md); root Cargo.toml path dep now in-repo. Verify: cargo metadata 0 escaping pkgs, cloud-api lib 168 pass + 1 known docker-less failure. |
| `6ac2e6244` | 4 (B2/A1/A4) | Scrubbed Clerk test password + Clerk sk_test from both surfaces; platform-auth-server.js + build-desktop-server.cjs now env-required (throw if unset); ProtonMail password/OTP env-var'd; deleted archive/link-card-service/private.pem; added .gitleaks.toml triage baseline + .github/workflows/secrets.yml (gitleaks on PR/push diffs). Verify: `gitleaks detect --no-git` 0 leaks. |
| `cf8798f97` | 5 (B1) | dev-api-token fallback gated behind `ALLTERNIT_ALLOW_DEV_API_TOKEN=true/1` (default REJECT) in auth middleware (2 sites), websocket, routes/auth; iOS literals moved to `ALLTERNIT_DEV_API_TOKEN` env. New regression test covers default-reject AND enabled-accept. **Backdoor still returns 200 live until the user deploys this commit.** |
| `31410cb1f` | 7 | Dead `allternit-cloud-api.fly.dev` repointed to `https://api.allternit.com` in 20 files (ai.allternit.com ×9, platform ×2, gizzi-code flag.ts, agent-daemon, cloud-wizard code+test, scripts, mobile AppConfig.swift, docs ×2). Also fixed 2 pre-existing wizard tests asserting `.JSONB` identity paths (codegen + all consumers use `.json`; 48→50 pass). |
| `b592df664` + `4476e933e` | 8 (C1) | `_redirects` static-asset pass-throughs: `/benchmarks/*`, bonsai worker, desktop-cloud-admin.html/.js, plugin-manager-demo.html, 3 remote-control PNGs, `/favicon.ico → favicon.svg`. NOTE: another session landed a parallel C1 fix on main mid-flight; rebased, deduped, kept main's auth-route rewrite removal (their live-verified sign-in fix wins). Verified via wrangler pages dev: leaderboard JSON serves real 1745B JSON. |
| — | 9 | Rebase onto origin/main (main had since merged a165be187 = identical Step-2 lockfile fix and 423a858e auth-route fixes → my Step 2 commit dropped as redundant; ChatComposer resolved to main's version). gitleaks `target/` allowlist added (cargo rmeta fixtures). `allternit-hosted-runtime/OPERATIONS.md` stray URL fixed. Both surface builds green post-rebase; gitleaks 0 leaks. |

## Findings the report should record

1. **headscale is ALIVE** — `allternit-headscale.fly.dev/health` = 200. The audit claimed headscale
   was dead; only the cloud-api fly host is. Headscale defaults (gizzi mesh.ts, cloud-wizard,
   tsnet-ios, config.yaml, OPS docs) deliberately NOT repointed.
2. **Pre-existing test debt (new ticket needed):** `allternit-cloud-wizard` `checkpoint_store::sqlite_tests`
   — 3 tests are a half-migrated sqlite→Pg half-migration (`":memory:"` / sqlite `?` placeholders
   against PgPool; Postgres has no :memory:). Fails on HEAD before my changes; needs `#[sqlx::test]`
   or a real PG testcontainer. Out of P0 scope.
3. **Pages `/*.html` canonicalization (pre-existing):** Cloudflare Pages 308s `/x.html` → `/x`
   before `_redirects` self-rewrites can serve standalone html pages (verified live on
   remote-control.html, which has had a self-rewrite rule all along). Extensionless paths are
   SPA-owned → standalone pages unreachable. Follow-up if they must be served: rewrite
   extensionless → `.html` explicitly (ties into Step 6 routing decision).
4. **History scan:** 219 findings across 2.1GB/1153 commits (redacted report
   `/tmp/gitleaks-history.json`, regenerable via `gitleaks detect --redact`). Breakdown:
   generic-api-key 135, curl-auth-header 26, sourcegraph-access-token 22 (a2r-workspace patches),
   private-key 19 (link-card private.pem ×5 + SSHKeyService fixtures), **stripe-access-token 12**
   (platform-auth-server.js ×6, .bak ×4, DEPLOYMENT_SECRETS.md ×2). HEAD is clean; CI gate scans
   diffs only. Rotation list delivered to user.

## Verification re-run at closeout (2026-09-03 ~21:45)

- `curl -H "Authorization: Bearer dev-api-token" https://api.allternit.com/api/v1/auth/me` → **200 (expected until user deploys cf8798f97)**
- `https://api.allternit.com/api/jobs` → 401 (matches B3 nuance: cloud-api intercepts; no jobs route exists)
- `https://ai.allternit.com/benchmarks/computer-use-leaderboard.json` → 200 application/json (live; parallel main deploy already carried the C1 class of fix)
- `cargo test -p allternit-cloud-wizard` → 50 pass + 3 pre-existing PG-env failures (documented above)
- `cargo test -p allternit-cloud-api --lib` → 168 pass + 1 known docker-less failure
- ai.allternit.com + platform.allternit.com production builds green post-rebase
- `gitleaks detect --no-git` → 0 leaks

## Deferred / user-executed

- **Step 6 (B3 web↔backend routing)** — reserved user decision; options delivered.
- **Deploy cf8798f97** (kills the dev-api-token backdoor) — user action.
- **Secrets rotation** (Clerk test password, Clerk sk_test_37qh7k8rZwwWu3QKPi2doqk10SabkYgIMCXEqkcQ,
  ProtonMail password+OTP, link-card private.pem, Stripe tokens ×12 in history, Sourcegraph tokens ×22,
  dev-api-token on deploy) — user action.
- P1/P2 items from the report — untouched.

## Scratch state left behind (intentional)

- `target` symlink in worktree → main checkout's shared 76G cargo target (remove when worktree is cleaned post-merge).
- `/Users/joe/Desktop/allternit-workspace/.cache-desktop-node_modules-b6d6153b` — desktop node_modules moved aside for CI-typecheck env; restorable.
- `/tmp/gitleaks-history.json`, `/tmp/gitleaks-postrebase.json` — regenerable scan reports.
- `surfaces/ai.allternit.com/public/discovery-feed.json` untracked — build-generated, not committed.

Worktree + branch intentionally left in place: merge to main is the user's/orchestrator's call
per repo convention; cleanup happens after merge.
