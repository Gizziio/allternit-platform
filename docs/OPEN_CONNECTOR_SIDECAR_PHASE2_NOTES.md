# Open-Connector Sidecar — Phase 2 Notes

> 2026-07-12. Follow-up to the phase 1 integration (see `docs/gap-analysis/OPEN_CONNECTOR_GAP_ANALYSIS.md` and `/Users/macbook/.claude/plans/reactive-wibbling-wilkinson.md`). Fixes two issues found during phase 1 live verification.

## What changed

- `cmd/allternit-api/assets/connector_id_aliases.json` (new) — hand-curated id mapping from Allternit's legacy catalog ids to open-connector's provider ids, for cases where the two catalogs spell the same real service differently. Verified against each provider's `displayName`/`homepageUrl` in `services/open-connector/src/providers/*/definition.ts`, not string-similarity guessing.
- `cmd/allternit-api/src/open_connector_proxy.rs` — added `sidecar_id()`/`allternit_id()` alias resolution (baked into the binary via `include_str!`, no runtime file I/O). Applied internally inside the proxy's own catalog/connect/execute/disconnect functions, so `connector_routes.rs` never needs to know aliases exist — it always sends and receives Allternit's own catalog ids.
- `scripts/dev-stack-watch.cjs` — added `companyConfigSnapshot`/`readCompanyConfigSnapshot()`/`hasCompanyConfigChanged()`. `fs.watch()` on `resources/company.json` was firing spurious change events on macOS (confirmed: the file's real mtime was untouched while "Company config changed, restarting API..." fired 6 times in under a second during phase 1 testing). The watcher now snapshots mtime+size right before arming and again after each confirmed real change, and ignores fs.watch events where neither differs.

## Alias mappings resolved

16 of the 88 originally-unmatched Allternit catalog ids were confirmed as genuine open-connector equivalents:

```json
{
  "apifymcp": "apify",
  "capsulecrm": "capsule_crm",
  "digitalocean": "digital_ocean",
  "dropboxsign": "dropbox_sign",
  "google_drive": "googledrive",
  "googleanalytics": "google_analytics",
  "googlebigquery": "google_bigquery",
  "googlesearchconsole": "google_search_console",
  "granolamcp": "granola",
  "highlevel": "high_level",
  "metaads": "meta",
  "mondaymcp": "monday",
  "onedrive": "one_drive",
  "slackbot": "slack",
  "tavilymcp": "tavily",
  "tiktok": "tiktok_business"
}
```

The remaining 72 (basecamp, bitbucket, salesforce, servicenow, snowflake, the zoho suite, etc.) are **not present in open-connector's 1,063-provider catalog under any spelling** — confirmed by checking `services/open-connector/src/providers/` directly, not assumed. These correctly continue to report `connectable:false` with an honest `not_in_sidecar_catalog` message. Adding real support for any of them would mean either open-connector adds the provider upstream, or Allternit writes a first-party provider definition for it — out of scope here.

## Live verification

- `cargo build --bin allternit-api` — clean (only the pre-existing, unrelated `unused_mut` warning in `agent_routes.rs`).
- `node --check scripts/dev-stack-watch.cjs` — clean.
- Full stack started (`node scripts/dev-stack-watch.cjs`), both API (8013) and sidecar (8014) reached ready state.
- `GET /api/v1/connectors`: **connectable count went from 93/181 (phase 1 baseline) to 108/181** — all 16 newly-mapped ids confirmed `connectable:true, executable:true, backend:"open_connector"` in the live response.
- Restart-storm fix: ran the stack for 90+ continuous seconds post-boot, zero "Company config changed" log lines, API process never bounced (stable single PID throughout).
- Clean shutdown: SIGINT to the stack process, confirmed no orphaned `allternit-api`/`open-connector` processes remained afterward, ports 8013/8014 released.

## Not verified / left as follow-up

- Whether a *genuine* `resources/company.json` edit still correctly triggers a restart — the fix logic guarantees this (any real mtime/size change passes `hasCompanyConfigChanged()`), but wasn't exercised with an actual live edit-and-observe-restart cycle in this pass. Low risk given the guard is a straightforward equality check, not a behavior change to the "changed" path.
- The github/notion/slack curated path was not touched and was not re-tested in this phase (it was already confirmed working in phase 1 and this phase made no changes near it).
- No OAuth-popup browser test — same as phase 1, left for manual testing.

## Process note

This phase was executed as: Kimi (tmux, `kimi --auto`) wrote all three code changes above and got partway through verification before hitting a hard API billing-cycle quota limit (`[provider.api_error] 403 You've reached your usage limit for this billing cycle`) — not a bug in its work, an external blocker. The orchestrating Claude session reviewed the already-completed code changes for correctness, then ran the build/live-verification/shutdown steps directly since no further reasoning work remained for a second external agent to do.

## Addendum — the catalog-size gap (found and fixed same day, after this doc's original verification)

Live testing after the alias/restart-storm work landed surfaced the real remaining gap: **Allternit's own legacy catalog (`assets/open-design/connectors.json`) only has 181 entries, period.** The sidecar work above (aliasing + restart fix) only ever enriched *those 181 entries* — it never added the ~950 other providers open-connector actually supports as new catalog entries at all. 108/181 was correct but was never going to be "over 1,000" no matter how good the alias mapping got, because the catalog itself was capped at 181 candidates before any of this work started.

Fixed directly in `cmd/allternit-api/src/connector_routes.rs`:
- `synthesize_sidecar_catalog_entry()` + `sidecar_only_entries()` — for every sidecar provider (via `provider_summaries()`, which already covers the full ~1,063) not already present in the legacy 181, synthesize a minimal catalog-shaped entry (id, display name, generic "Open Connector" category) and run it through the existing `merge_sidecar()` exactly like a real catalog entry.
- `list_connectors` now unions legacy-catalog entries + sidecar-only entries. `get_connector` falls back to a sidecar-only lookup when an id isn't in the legacy catalog before 404ing.
- **Result: total catalog 181 → 1,137 entries; connectable 108 → 1,064.**

This also exposed a latent perf issue: `merge`/`merge_sidecar` each did their own per-connector SQLite query (`db.connect()` opens a fresh connection every call, no pooling — see `db.rs`), which was fine at 181 entries (~1.4s) but became ~4.4-5s at 1,137 entries (~1,137 connection opens per request). Fixed with `fetch_connection_rows()` — one batched `SELECT ... WHERE user_id=?1` per request instead of one per connector, passed through to `merge`/`merge_sidecar` as a lookup map. **Warm-request latency: ~4.4-5s → ~0.79s.** (First request after a process restart is still ~11s while the sidecar's own 60s provider-catalog cache warms from cold — expected, not a regression.)

Verified live: total 1,137, connectable 1,064, executable 1,062. Curated github/notion/slack unchanged (regression-checked). Clean build, clean shutdown, no orphaned processes.
