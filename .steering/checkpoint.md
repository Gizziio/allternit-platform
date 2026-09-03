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
