# Session Attestation — session/bots-p04 (kimi) — Bot Teammates Phase 4

- **Date:** 2026-09-07
- **Branch:** `session/bots-p04` @ 9d26a62d3 (fast-forwarded to `main`).
- **Spec:** `docs/BOT_TEAMMATES_SPEC.md` — Phase 4 (Server-side groups, AD-2).

## What was done

- **`cmd/allternit-api/src/group_rooms.rs`** (new, ~1000 lines): SQLite rooms store (`group_room_projections` / `_watermarks` / `_holds`), bounded projection caps enforced at write (last 16 msgs, 1200 chars/msg, ≤48KB → 413), CAS `put_projection` (409 `revision_conflict`/`room_tombstoned`), tombstones (GET→404, `changes_since` still surfaces disbands), monotonic per-member watermarks, holds lifecycle, 9 endpoints behind existing auth.
- **Surface sync** (`lib/bots/group-rooms-sync.ts` + `group-rooms-api.ts`, new): fail-closed on rails env; client mirrors caps; append-only union merge on 409; re-seed on pull; tombstone apply (never resurrect); local-disband → server tombstone watcher; watermark bump fire-and-forget mirror.
- **Turn runner**: watermark-gated member history (local fast path untouched when API absent), `@user` → escalation hold, room push after turn.
- **Inbox** (ShellRail): "Group escalations" section, resolve-on-open.
- Rust edits to existing files: 2 one-line registrations only (lib.rs, main.rs).

## Verification

- `cargo check -p allternit-api` ✅; `cargo test -p allternit-api --lib group_rooms` 13/13 ✅.
- tsc clean on touched files; vitest 1316 passed; sole failure `fabric-session-kind.test.ts` = known pre-existing on main (other session's bot-home work, verified identical content at 762eeb5e1).
- `bun run build` blocked by known stale-univerjs install (other session's in-flight dependency bump); all modules transform.

## Notes

- Live-daemon curl smoke deferred (routes behind Clerk middleware); covered by in-process HTTP round-trip test.
- Merge of origin/main auto-merged ShellRail cleanly; only checkpoint conflicted (resolved ours).
