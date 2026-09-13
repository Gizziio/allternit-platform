# Session attestation — session/console-fe-p6 (2026-09-13)

**PR:** #464 (merge `dd8627e33`) — `feat(platform-console): Phase 6 — Dashboard 1:1 + Gizzi Code usage`
**Program:** Frontend console port, Phase 6 of 7.

## What was done

- **Dashboard rebuilt to Anthropic parity**, every number from a real endpoint: greeting + Get API key / Build an agent actions; credits card (`balance_cents`, hidden on 403/no-org); spend-this-month gauge (`current_month_spend` vs `monthly_usd_cap`, hidden on 403/zero cap, reset hint client-side since the payload has none); caching card (30d hit rate + savings from /gateway/caching); token-volume card (7d totals, honest empty state → Try a prompt); model cards from the live `/v1/models` catalog (taglines from `quality_tier`, real input/output pricing + context window only — nonexistent fields omitted); resources row. Playground honors `?model=` deep links. Every card has kit Skeleton + one-line error fallback; dashboard renders complete with zero data.
- **Gizzi Code usage** over `/api/v1/admin/analytics/gizzi-code/usage`: lines accepted, tool-call accept rate (accepted/(accepted+rejected)), sessions (labeled upper bound — SQL groups by bucket), spend, per-bucket table + CSV export. Honesty gate: telemetry-off → "Set GIZZI_TELEMETRY=1 on clients…" (env verified gizziUsageTelemetry.ts:8); 403 → org-admin state.
- **Last stub retired**: /manage/rate-limits → redirect to /analytics/rate-limits (its content shipped in Phase 4); the entire stubs directory is deleted — zero ComingSoon pages remain.

## Verification evidence

- tsc 0 errors; build success; preview 200 on / and /gizzi/usage; release-preflight 35/0. Parent re-verified + removed the final stub and dead files independently.

## Honest deferrals

- No per-member gizzi table (endpoint has no per-member grouping — per-bucket instead). No auto-reload hint (no backend flag). No cache pricing rows (not in /v1/models payload).
- Signed-in interactive smoke — program-wide deferral. No desktop rebuild (not desktop-bundled).
