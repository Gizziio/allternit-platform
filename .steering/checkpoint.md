# Steering checkpoint — P0 gap-analysis execution (2026-09-03, session b6d6153b)

## Goal
Work the P0 list from `reports/2026-09-03-production-readiness-gap-analysis.md` in order (Steps 0–9), one change at a time, verify-before/after each. Worktree: `allternit-session-b6d6153b`, branch `session/b6d6153b`.

## Just did (Step 0 — baseline, all evidence fresh)
- Worktree created at 88baa91ab. NOTE: `npx tsc` in a fresh env silently runs the npm tsc stub (typescript not installed) — the audit's verify command must use `./node_modules/.bin/tsc`. Copied desktop node_modules dereferenced + symlinked root node_modules to reproduce CI-typecheck env in the worktree.
- B1 CONFIRMED LIVE: `curl -H "Authorization: Bearer dev-api-token" https://api.allternit.com/api/v1/auth/me` → 200 `{"is_development":false,"permissions":["*"],"token_id":"dev-token","user_id":"dev-user"}`.
- B3 NUANCE: `/api/jobs` now returns **401** UNAUTHORIZED (cloud-api intercepts, no jobs route in source) — report said 404. Routing story STILL undecided (no route exists). Reconcile, don't fight.
- C1 CONFIRMED: `/benchmarks/index.html` → 200 text/html 4202B SPA fallback.
- B7 CONFIRMED: deploy-cloud-api-contabo 5 consecutive failures; deploy-cloudflare-pages last 2 fail; ci-desktop last 2 fail — ci-desktop dies at `pnpm install --frozen-lockfile` step (lockfile mismatch) before typecheck.
- B4 CONFIRMED: tsc main tsconfig = 9 errors, preload = 2 (dup keys index.ts:399-400) — matches A1's 11.
- B5 CONFIRMED: `gh repo view allternit/desktop` → 404.

## Just did (Step 1 — COMPLETE, B4 merge repair)
- unified-main.ts: removed duplicate `hudWindow`/`remoteControlWindow` state decls; restored `effectiveMode` declaration (from parent 2 of ea89a5fdb: `backendConfig?.mode ?? (isDev ? 'development' : 'bundled')`); deleted the duplicate block-A `createHudWindow`/`showHudWindow`/`hideHudWindow`/`toggleHudWindow` (kept block-B NSPanel version + openHudWindow/pushHudState); `toggleHudWindow` now HIDEs (tray/minimize contract) instead of close; deduped the 4 double-registered `shell:*-hud` IPC handlers — `move-hud` now accepts BOTH renderer shapes ({dx,dy} from HudApp and {x,y,width,height} from composer-drag); `close-hud` = hide + pushHudState; single `show-hud` registration added.
- preload/index.ts: removed duplicate `closeHud`/`toggleHud` object keys (TS1117 ×2).
- Verify AFTER: main tsc 0 errors (was 9), preload tsc 0 (was 2), no duplicate ipcMain.handle channels, no dangling refs, vitest 94/94, `npm run build` green.

## Next
- Step 2: fix pnpm-lock.yaml overrides mismatch (`pnpm install --lockfile-only` at root; confirm `pnpm install --frozen-lockfile` passes).

## Open questions
- Step 6 (routing story) is a user decision — must ask once Steps 1–5,7–8 done (per stop conditions).
- Secrets rotations (B1/B2/backdoor deploy) are user-executed; I prepare changes only.

---

# Steering checkpoint — platform follow-up pass

## Goal
Add Groq to the live Allternit Cloud model catalog, prove `/v1/chat/completions` works across all listed providers, and verify the deployed `platform.allternit.com` pages render correctly in a browser.

## Just did
- Created session worktree `allternit-session-platform-followup-20260903` on branch `session/platform-followup-20260903`.
- Queried Groq `/v1/models`; confirmed Groq returns pricing as numeric strings.
- Fixed `generic_openai.rs` `OpenAiPricing` to deserialize prices from either JSON numbers or numeric strings.
- Added 4 curated Groq aliases to `catalog.rs`: `qwen3.6-27b-groq`, `qwen3.8-27b-groq`, `gpt-oss-20b-groq`, `gpt-oss-120b-groq`.
- Updated router unit tests for the expanded 24-entry catalog; all 12 model_router tests pass.
- Built and deployed the API binary to the VPS; verified `/v1/models` returns 24 models including the 4 Groq aliases.
- Smoke-tested `/v1/chat/completions`: Together (works), Groq (works + streaming works), Fireworks (routes, model returns empty content), DeepInfra/OpenRouter blocked by upstream account balance.
- Verified `platform.allternit.com` pages in headless browser; found and fixed:
  - `model-catalog.ts` was reading prices/name/context only from `extra`, but the API flattens them to top-level fields.
  - Updated `ModelsPage.tsx` and `PlansPage.tsx` provider copy to list Groq as live.
- Ran `bun run typecheck` and `bun run build` for the platform surface; both pass.

## Next
- Commit API and front-end changes, push `session/platform-followup-20260903`, merge into `main`, and deploy `platform.allternit.com`.
- Re-verify production `/models` shows prices and Groq copy after deploy.
- Clean up worktree/branch and update ledger.

## Open questions
- Fireworks aliases route successfully but the chosen reasoning models (DeepSeek V4 Pro, Qwen 3.8 Max) return empty `content`. Is this acceptable for now, or should we swap to non-reasoning Fireworks aliases?
- DeepInfra and OpenRouter keys have no upstream balance; should we add credits or remove them from marketing until funded?

---

# Steering checkpoint — cloud billing guards (2026-09-03, session ba9de8f8)

## Goal
Close the bankruptcy-risk gaps identified in the free-tier/billing review: free inference allowance, chargeback hold, disk quotas, free-path rate limit, daily revenue reconciliation.

## Just did
- Shipped all five guards (commit b3d7404bf), deployed to mail, 143/143 lib tests green, health green, no new prod errors.
  - G1 disk quotas: storage-opt behind fs-capability const (nodes are ext4/overlay2 → flag off) + reconciler sweep stops over-quota containers (`disk_quota_exceeded`).
  - G2 free inference: no-credits-row users get $2/calendar-month (FREE_INFERENCE_MONTHLY_USD), enforced pre-dispatch; `GET /billing/credits` now returns `free_inference` consumption.
  - G3 free-path rate limit: 30 rpm per user (FREE_INFERENCE_RATE_LIMIT_RPM), 429 + Retry-After; paid users unaffected.
  - G4 chargeback hold: `billing_purchase_trust` (pg 008/sqlite 029); untrusted buyers capped at $25 (FIRST_PURCHASE_MAX_USD) for 14 days on packs AND subscriptions; webhook records only fresh grants.
  - G5 reconciliation: `reconcile_billing.py` + systemd daily timer on mail, smoke-tested live (wholesale 24h $43.68 < $50 alert, metering gap 0). Posts to Alertmanager.
- Console: BillingPage free-inference card (agent-14), deployed via deploy-cloudflare-pages workflow.
- Two-node fleet decision + node-selection-shipped recorded in CAPACITY_PLAN.md (b98996f28); AllternitOS coordination doc updated (cloud-api ledger is source of truth; OS UsageEvent reconciles into it).

## Next
- Check who/what drives the ~$43.68/day wholesale inference volume (user sessions vs OS session vs real users) — at ~$1.3k/mo it's the biggest cost line.
- First real Stripe pack purchase still pending user action; chargeback hold will apply to it ($10/$25 fine).

## Open questions
- Free allowance abuse guard beyond per-IP: Clerk JWT carries no email-verification flag; if sock-puppet abuse appears, gate the allowance on verified email (needs Clerk API lookup) or a $1 card check.

---

# Steering checkpoint — inference cost architecture (2026-09-03 cont., session ba9de8f8)

## Just did (all deployed to mail + pushed)
- PRICING BUG fixed: generic_openai stored per-1M prices where router expects
  per-token → 1,000,000x overmetering (a 42-token call metered $43.68).
  Normalized in insert_pricing_extras (+2 regression tests); prod row corrected.
  Root-caused via the reconciliation alert — it earned its keep on day one.
- STALE BINARY incident: cargo test --release --lib does NOT refresh
  target/release binary; 3 deploys copied a 07:26 build. Rebuilt for real,
  re-deployed, verified (pools seeded, guards live). Runbook written:
  docs/Operations/CLOUD_API_VPS_DEPLOY.md — always cargo build --release,
  verify the swap (mtime + startup log + DB object).
- Pool broker + circuit breaker (067dc4a6c): inference_pools seeded per
  provider ($100/mo default, per-provider POOL_BUDGET_USD_<P> override),
  80% warn / 100% hard 403, pool_id on every usage row, per-pool wholesale
  in reconciliation. FREE_TIER_POOL_POLICY=cheap_only ships inert.
- BYOK (af922a44e): user_inference_keys (AES-GCM via existing credential
  cipher), validate-on-save, GET/PUT/DELETE /api/v1/inference/keys, per-request
  GenericOpenAiProvider dispatch, meter-tokens-charge-nothing, console
  "Provider API keys (bring your own)" card live on platform.allternit.com.

## Next
- User: create DeepSeek and/or Kimi API accounts, prepay small balance, give
  keys → we add provider env + FREE_POOL_PROVIDERS + flip cheap_only.
- At ~$3-5k/mo paid frontier volume: negotiate committed-use discounts.
- Fair-share weights within pools (per-user token buckets by plan tier) when
  multi-tenant pool contention appears.

## Open questions
- Free-tier abuse guard: Clerk JWT has no email-verification flag; if
  sock-puppets appear, gate the $2 allowance on verified email or $1 card check.
- Fireworks reasoning models return empty content (parallel session's note);
  DeepInfra/OpenRouter keys have no upstream balance (theirs to fund/remove).

---

# Steering checkpoint — auth unification + billing soak green (2026-09-03, session ba9de8f8)

## Just did (deployed to mail, soak-verified)
- AUTH GAP closed: billing routes were Clerk-session-only while chat accepted
  Bearer api tokens — the soak's first live run failed 4 checks on exactly
  this. `auth/resolve.rs` (`resolve_user_id`: Clerk first, Bearer
  api-token fallback) now backs billing_checkout/credits/subscriptions,
  hosted_runtimes, inference_keys. 167 lib tests green on mail.
- GROQ PER-TOKEN PRICING bug found by the soak (undermetering, the inverse of
  the earlier overmetering fix): Groq /models quotes per TOKEN
  ("0.0000006" for $0.60/1M) but generic_openai ingest assumed per-1M and
  divided again → ~1,000,000x under retail ($8.64e-11 recorded for a real
  call). Fixed with `per_token_price` unit-threshold normalizer (<1e-4 →
  per-token; ranges never overlap in practice) + 2 regression tests.
- Billing soak `infrastructure/cloud/soak_billing.py`: 12/12 GREEN against
  live localhost:8082 (paid retail deduction exact to the cent, free
  allowance w/o ledger deduction, zero-balance 403 pre-dispatch, usage row,
  BYOK list + invalid-key rejection).
- deploy-cloud-api.sh fixed for macOS bash 3.2 (mapfile → for loop).
- session/desktop-cloud-mvp merge (71 conflicts) resolved by its owner and
  sealed as ea89a5fdb; auth + pricing fixes rode in via it. Tree compiles;
  cloud-api lib tests 167/168 (known no-docker contabo baseline).

## Next
- Push main (45+ commits incl. this merge) — awaiting explicit user go.
- /healthz now returns UNAUTHORIZED post-swap while service is active; check
  the deploy script's step-6 verify path against the health route's auth.
- Real $10 Stripe purchase (user), CI/CD Tailscale auth key (user),
  cheap-provider pool (deferred), Clerk-only compute-route sweep (optional).

## Open questions
- Wholesale side for Groq models: input_cache_read pricing (cached reads at
  half price) is ignored — fine at current volume, matters at scale.

---

# Steering checkpoint — compute-route auth sweep deployed (2026-09-03, session ba9de8f8)

## Just did (deployed to mail, verified)
- Clerk-only compute-route sweep: ~25 call sites across 11 route files now
  use auth::resolve_user / resolve_user_id (Clerk session OR Bearer
  api token). Agents with API tokens can now manage their own compute:
  hosted runtimes (list/create/start/stop/destroy), contabo provisioning,
  gizzi instances, provider tokens, runtime relay, pairing approve/revoke,
  mesh enroll, wizard, dispatch handoff, api-key list/revoke.
- SECURITY FIX en route: contabo hosted-runtime destroy had NO ownership
  check (service destroy not user-scoped) — any authenticated user could
  destroy anyone's runtime by id. Route now verifies ownership first.
- Token minting (POST /api/v1/api-keys) deliberately stays Clerk-only:
  no token-mints-token privilege escalation; org binding from Clerk claims.
- Verify on mail: 168/168 release tests, billing soak 12/12 green,
  new sweep_smoke.py 5/5 (Bearer token gets 200s on swept endpoints).

## Next
- Push main (now ~48 commits ahead of origin incl. this sweep).
- User actions unchanged: $10 Stripe purchase, Tailscale reusable auth
  key for CI/CD, cheap-provider keys (DeepSeek/Kimi).

## Open questions
- Should scoped api tokens carry permissions (they have a permissions
  column already) so e.g. a read-only token cannot destroy runtimes?
  Currently any valid token gets full user power on management routes.

---

# Steering checkpoint — scoped tokens + CI/CD shipped (2026-09-03, session ba9de8f8)

## Just did (deployed to mail, all regressions green, pushed)
- Scoped API tokens: alt_ keys (api_keys table) now actually validate —
  they were minted by the platform but wired to nothing. Scopes enforced
  via resolve_user_scoped: inference / compute / billing / account.
  Legacy ['*'] default keeps existing tokens full-access. Live scope_check
  8/8 (inference token: chat 200, compute+billing+account 403; compute
  token inverse; wildcard all 200).
- CI/CD: deploy-cloud-api-contabo.yml rewritten — test job (release suite
  on Postgres service container, docker available) gates a deploy job that
  joins the tailnet (TS_AUTHKEY) and swaps the binary onto mail via
  deploy-contabo.sh, now with health verification + automatic rollback.
  Push to main on cloud-api paths self-deploys.
- Regressions: soak 12/12, sweep smoke 5/5, scope check 8/8, 168/168
  release tests on mail.

## Next (user actions)
- Tailscale admin: create reusable tag:ci auth key, allow tag in ACL
  (snippet in docs/Operations/CLOUD_API_VPS_DEPLOY.md § CI/CD), then
  `gh secret set TS_AUTHKEY`. Optional CONTABO_SSH_KEY if no SSH ACL.
- Deferred: real $10 Stripe purchase, cheap-provider pool keys.

## Open questions
- Frontend should expose scope selection at key-mint time (platform
  allternit.com API-keys panel currently posts scopes — verify it sends
  meaningful defaults, not empty = full).

---

# Steering checkpoint — session handoff (2026-09-03, session ba9de8f8, FINAL)

## Goal
Allternit Cloud Phase 2/3 migration + production hardening. Session closing; another agent picks up.

## Just did
- All work deployed to mail (Postgres prod) and pushed; origin/main = 97ecec0bb, checkout clean.
- This session's full state written to agent-ledger attestation:
  agent-ledger/summaries/2026-09-03-1716-ba9de8f8-kimi-cloud-backend-hardening.md (+ LEDGER.md entry).

## Next (for the picking-up agent)
- Goal milestones 5 (Hetzner standby failover test per FAILOVER_RUNBOOK.md) and 8 (CI/CD proof run via workflow_dispatch after TS_AUTHKEY) still need their proof checks; /goal resume.
- Owner actions pending: Tailscale tag:ci auth key + gh secret set TS_AUTHKEY; real $10 Stripe purchase; DeepSeek/Kimi prepaid keys for the cheap free pool.
- Follow-up: platform key-mint UI should default sensible scopes (empty = full access today, by design).

## Open questions
- Unchanged from previous checkpoint.
