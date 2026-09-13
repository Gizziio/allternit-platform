# Steering checkpoint — session/console-fe-p4

**Goal:** Frontend console port Phase 4 — Analytics: Usage, Logs, Caching, Rate limits, Cost pages over live gateway routes. Build on platform's own usage lib, NOT the ai donor (local-gizzi URLs).

**Just did:** Resumed an interrupted Phase 4. Found on disk: gateway-analytics.ts + 5 page files complete and shape-correct, but App.tsx was half-wired (new page imports added while `consoleStubRoutes` still referenced the removed `Analytics*StubPage` imports — would not compile) and the 5 stub components were still in consoleStubs.tsx. Fixed: pointed `/analytics/{usage,logs,caching,rate-limits,cost}/*` at the real pages as ConsoleRoutes, removed the 5 stub routes + stub components (header comment now records Phase 4 retired them), fixed one tsc error in CachingPage (`{data?} & Array<>` → union type on the `/v1/context-caches` list response). pnpm-lock.yaml churn from `pnpm install --filter` reverted.

**Backend shapes confirmed (file:line):** usage `admin_routes.rs:286-421` (day rows day/provider/model/virtual_key_id/key_prefix + tag mode via `group_by=tag` only — other values 400); logs `admin_routes.rs:448-556` (cursor `created_at|id`, `?tag=` json_each match at :484-486, `?status=`, limit 1..=200); caching `admin_routes.rs:585-752` (`period=<n>d`, totals/by_model/context_caches/prompt_caches, `savings_estimate_basis`); keys `keys.rs:238-275` (`{keys:[…]}`); tags `tag_routes.rs:100-145` (`{tags:[…]}`); caller rate limits `proxy.rs:2830-2862` (`/v1/rate-limits`, ak- key auth, requests_remaining/requests_limit/tokens_remaining(cents)/tokens_limit/reset_at RFC3339); context caches `mod.rs:94-95` + `context_cache.rs:70-254` (POST body name/messages/ttl_seconds, list `{object:"list",data:[…]}` with unix created_at/expires_at, delete 204); admin rate limits `admin_rate_limit_routes.rs:37,82-124,158-217` (PUT nullable semantics, 0 rejected); message-level `cache_control` accepted on chat messages `translate.rs:176-191` — the empty-state curl hint is the real request shape; cloud costs `cmd/allternit-cloud-api/src/routes/costs.rs:234-265` + `services/cost_service.rs:128-135` (`?month=YYYY-MM`, `?group_by=provider|region|instance_type`, breakdown rows carry total_duration_hours; summary carries total_duration_hours + budget_status).

**How Cost gets its data:** `/api/v1/costs/*` lives only in allternit-cloud-api (no matches in allternit-api), but api.allternit.com fronts both services by path — same pattern as hosted-compute.ts (`VITE_ALLTERNIT_CLOUD_API_URL`, default https://api.allternit.com). So the platform `api` client (base = same host) reaching `/api/v1/costs/*` is the existing platform pattern (PlatformUsageDashboard already consumed usage.ts); this phase only added optional `month` params and corrected CostBreakdownItem fields to the real wire shape. Caveat: in local dev where VITE_ALLTERNIT_GATEWAY_URL points at a local allternit-api only, costs 404 — pre-existing, unchanged.

**Columns omitted as nonexistent:** web-search counts (no such fields on llm_usage_events → UsagePage has tokens in/out + spend cards only); `service_tier` on log rows (not in the SELECT → LogsPage omits it).

**UsagePage note:** API-key filter is client-side over fetched rows (the usage endpoint has no key query param — verified at admin_routes.rs:274-311); tag filter maps to the real `group_by=tag` mode.

**Verification:** platform `npx tsc --noEmit` 0 errors; `pnpm build` green; `pnpm preview --port 3047` curl 200 on all 5 analytics routes, preview killed; `node scripts/release-preflight.mjs` 35 passed, 0 failed.

**Next:** Parent: review, commit/push session branch, PR + merge, attest, cleanup per session ritual.

**Open questions:** None.
