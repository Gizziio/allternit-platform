# Session attestation — fastload-0914 (part 2) — mainline boot repair + live launch test

- **Session:** `session/fastload-0914` (kimi-code), DAG `dag_492447`
- **PRs:** #535 (ao-engine Cargo.toml parse), #541 (migrations + axum routes), #542 (splash force-close)
- **Date:** 2026-09-14 23:55

## What was done

While testing the desktop fast-launch build (PR #533), discovered that **no
allternit-api built from main could boot** — three more layers of the same
union-merge damage beyond the Cargo.toml duplicate key (#535):

1. **Duplicate migration versions** (cmd/allternit-api/migrations): two
   migrations claimed each of V47/83/86/93. Fresh DB: refinery UNIQUE
   violation; existing DB: name-mismatch error. Fixed by keeping the
   release-lineage file at each version (v1.1.1 tag / b2612 binary
   evidence), renumbering the others to V177–V180 byte-identical (V47 pair
   deduped against the tag's canonical `V47__session_memory`).
2. **V87/V88 webhook conflict**: both created `webhook_triggers` with
   incompatible schemas (user-centric vs bot-centric); V88's index always
   failed on fresh DBs; the sole Rust consumer reads the V87 shape. Folded
   into one idempotent V87 union schema (V87 shape + V88's nullable extras,
   all indexes IF NOT EXISTS); V88 deleted.
3. **Duplicate axum routes**: photon_routes and allternit_bus_routes
   registered the same six paths into one app → router-construction panic.
   Ownership split by evidence (live frontend wallet contract pins
   agent_routes wallet; connector_routes tests pin the bus connector/email
   handlers). ~760 lines of orphaned handlers/types/imports removed (the
   earlier "byte-identical" claim did NOT hold — real diffs found in
   resolve_agent_connectors, provision_email, and a masked wallet-route
   duplicate vs agent_routes).
4. **Splash force-close fix** (#542): the 15s force-close could never fire
   while the folder-grant step was pending, leaving the always-on-top
   splash covering the loaded app indefinitely.

## Live launch test (real install, cold start, fresh DB)

Installed `Allternit-Desktop-1.1.1-b673e0b1-arm64.dmg` (unsigned local
build per ritual; asar + api binary + icon hash-verified before install).

Timeline from main.log (2026-09-14 23:47): init 09.2 → connector 0.7s →
office 1.1s → local engine 1.7s (ECONNREFUSED fast-path; was 20.8s) →
gizzi 2.7s → API spawn 2.8s → **API ready 7.6s** (includes fresh-DB
migrations V1–V180) → fabric worker provisioned → **window finished
loading 7.85s**. Screenshot-verified: new A://TERNIT splash rendering,
folder-grant prompt non-blocking with the platform loaded behind it.
`/health` → 200 `{db, jwks, gizzi}` all true.
**Before: 26.3s to backend-ready (window often never came / hours behind
the grant gate). After: ~7.9s to a loaded window.** Fail-fast also proven
live: migration panics surfaced with full stderr in <1s.

## Environment notes / honest deferrals

- This dev machine's DB history had repeated migration conflicts (multiple
  `.bak`/`.disabled` files since Aug 30; dev APIs on :18013 share the
  packaged app's data dir and migrate it forward). The pre-existing DB was
  archived (`allternit.db.bak.before-v47-mismatch-20260914`), not deleted;
  a test artifact DB was also archived. DBs that recorded the
  non-canonical names at 47/83/86/93 still need a one-time
  refinery_schema_history row fix (documented in PR #541).
- Known non-fatals observed live: ACU gateway (uvicorn missing on host —
  KNOWN-ISSUES.md), mesh enrollment 502, autoUpdater dev-feed error,
  Clerk script load failure on the auth renderer, fabric worker
  chdir warning to ~/fabric-worker. All post-boot/runtime, none gate
  launch; separate follow-ups.
- Pre-existing, not fixed: `cargo test -p allternit-api --lib` test-fixture
  compile error (AppState literal missing 14 fields in vm_session_routes
  test code); V93≡V128 redundant duplicate (benign); V1-vs-V86
  memory_entities shape drift.
- DMG rebuild including #542 was pending at attestation time.
- Incident: macOS TCC revoked Terminal's Desktop-folder access mid-session
  (whole ~/Desktop EPERM, Documents/Downloads unaffected); owner restored
  access. Root cause presumed folder-scoped grant churn; Full Disk Access
  recommended for durability.
