# Session attestation — session/console-fe-p4 (2026-09-13)

**PR:** #458 (merge `da3c72a49`) — `feat(platform-console): Phase 4 — Analytics surface`
**Program:** Frontend console port, Phase 4 of 7.

## What was done

Full Analytics surface in `surfaces/platform.allternit.com`, every shape verified against Rust handlers (citations in `src/lib/gateway-analytics.ts`):

- **Usage**: range 7/30/90d, model + API-key filters, group-by model|tag (real `group_by=tag` mode), recharts chart, client-side CSV export. Web-search counts omitted (no such fields on llm_usage_events).
- **Logs**: per-request table over `/api/v1/gateway/logs` — ID MonoChip, status, time, model, in/out tokens, latency; search; tag filter (backend json_each); cursor pager; detail drawer with pretty JSON; "within a minute; batch not included" note. service_tier omitted (not in the handler's SELECT).
- **Caching**: `/api/v1/gateway/caching` hit-rate gauge + savings estimate + per-model stats; `/v1/context-caches` create/delete via the ak- virtual key; copyable `cache_control: {type:"ephemeral"}` curl (confirmed `translate.rs:176-191`).
- **Rate limits**: `/v1/rate-limits` caller snapshot (ak- auth, RFC3339 reset_at, cents-based budget per `proxy.rs:2830-2862`) + admin GET/PUT edit form, graceful read-only on 403.
- **Cost**: `/api/v1/costs*` (cloud-api crate fronted by the same host — the platform's existing pattern); added `?month=` and corrected wire shapes (`total_duration_hours`, required provider/region/instance_type).

Interrupted first attempt was audited shape-by-shape against the Rust before keeping; fixed App.tsx wiring, stub removal, one type error. 5 stubs removed (18 → 13).

## Verification evidence

- tsc 0 errors; build success; preview 200 on all 5 routes; release-preflight 35/0. Parent re-verified independently.

## Honest deferrals

- Signed-in interactive smoke — program-wide deferral. No desktop rebuild (not desktop-bundled).
- Pre-existing caveat: a local dev gateway URL pointing at allternit-api alone 404s on `/costs*` (cloud-api-only paths) — not introduced by this phase.
