# Day-One Launch Scope — DRAFT for decision (2026-09-04)

**Status:** DRAFT — needs owner sign-off. **Source:** gap analysis (2026-09-03, grade D+), P0/P1/P2 execution
attestations, corroboration addendum. All P0/P1 code items are merged unless marked 🔶.

---

## Recommendation

**Ship web-only on day one:** `ai.allternit.com` + `platform.allternit.com` + `api.allternit.com`.
This matches the audit's own bottom line: *"web-only tomorrow after P0, desktop and CLI follow on their own tracks."*

## Ships day one

| Surface | State | Caveat |
|---|---|---|
| ai.allternit.com (web SPA, Cloudflare Pages) | Live, builds green, `verify-ai` CI gate (1160 tests), CSP/HSTS, ErrorBoundary | — |
| platform.allternit.com (billing) | Live, cloud-api integration verified working | — |
| api.allternit.com (cloud-api, Contabo VPS) | Live; backdoor 401-verified dead; email-verification trust gate; billing guardrails | First deploy off merged main runs 11 convergent migrations — **watch the log** (`ALLTERNIT_SKIP_MIGRATIONS=1` escape hatch) |
| Web↔backend routing | Decided (option b): cloud-api is the single public API; interim nginx proxy on VPS live with CORS allowlist + rate limits | 8013 routes mount into cloud-api over time (post-launch) |

## Does NOT ship day one (explicit deferrals)

| Item | Why not | Track |
|---|---|---|
| Desktop (Electron) | Compiles + release pipeline fixed, but **unsigned, no `allternit/desktop` repo**, never runtime-launched, 608MB hollow-artifact history | Owner-gated (Apple cert). "macOS signed release in 1–2 days; Windows/Linux early-access after gating" — announce as coming soon |
| gizzi-code GA | Packaging code fixed (bin launcher, publish gates) but **no verified fresh npm publish**; A4 deep-dive: SSRF, 86 audit vulns, unauth LAN API, plaintext keys in TOML | Phase 0 done; GA est. 4–6 weeks |
| iOS app | Field builds hardcode the now-dead dev-api-token → **presumed broken against prod right now**. Needs rebuild + TestFlight/App Store cycle | Decide messaging: pull from site / "update coming" banner |
| Marketing sites (labs serves wrong app, 3dfacility missing, no analytics) | Separate repo, own work order | Post-launch |
| Long-term per-sub Incus data planes | Architecture decision D3, P2 | Post-launch |

## Go/no-go checklist (all must be ✅ before announcing)

- [ ] `gh secret set TS_AUTHKEY` (Tailscale reusable `tag:ci` key) — CI deploys fail at "Join Tailscale" without it
- [ ] Push the 4 unpushed commits on main; `deploy-cloudflare-pages.yml` + `deploy-cloud-api-contabo.yml` green
- [ ] First cloud-api deploy watched: 11 idempotent migrations converge on already-migrated prod DB
- [ ] Secrets rotation executed (runbook: `reports/2026-09-04-secrets-rotation-runbook.md`) + agent cleanups after
- [ ] Post-deploy smoke: backdoor 401, `/api/v1/health/ready` ready, authed happy-path 200, Clerk e2e verify, web `/sign-in` + benchmarks HTML >4202 bytes
- [ ] iOS messaging decision (see above)
- [ ] Launch-scope sign-off on this doc

## Week-one (post-launch, already scoped)

- Commit Prometheus/Grafana/Alertmanager configs to repo (currently untracked manual state on VPS — rebuilding mail loses alerting silently)
- Desktop: Apple cert → signed macOS release → `allternit/desktop` repo → early-access Windows/Linux
- Verify fresh gizzi-code npm publish works end-to-end through the new gates
- Dedupe when `session/routing` lands: dev-token gate env names (`ALLTERNIT_ALLOW_DEV_TOKEN` vs deployed `ALLTERNIT_ALLOW_DEV_API_TOKEN`), contracts in two locations (`platform/contracts/` vs `platform/protocols/allternit-cloud-contracts`)
- Restore drill for off-host backups (write-tested, never restore-tested)
- Uptime monitoring / status page / paging (none exists)

## Known accepted risks (owner should explicitly accept)

1. **Fabric `/v1/responses` is a charging stub** — if the 8013 surface is ever exposed publicly, customers get charged for canned output. Mitigation today: it's not publicly reachable (nginx only proxies known prefixes).
2. **Internal billing endpoints are public** behind one env secret + 30 rpm limiter.
3. **Single box runs hosted workloads + PG primary**; allternit-api runs as root; Incus 8443 open to internet via bootstrap-host.sh.
4. **Clerk proxy reflects any Origin with credentials**, no CI for it — live state unverifiable from repo.
5. **60 rpm default rate limit** may be tight for a multi-user SPA.
6. **Observability stack untracked** (see week-one).
7. **Free-allowance anti-abuse** is per-user-id; email-verification gate has a bypass env.
8. **History purge deferred** — rotation makes leaked tokens dead; BFG purge is optional cosmetic.
