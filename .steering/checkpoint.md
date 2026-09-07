# Steering checkpoint

## Goal
BOT_TEAMMATES_SPEC Phase 4 (Server-side groups, AD-2) in worktree
`/Users/joe/altw/allternit-session-bots-p04` (branch session/bots-p04,
main @ 4e39ecd4a, Phases 0-2). Parent lands the branch — DO NOT
git commit/push. Conflict minimization honored: all Rust in NEW
cmd/allternit-api/src/group_rooms.rs + ONE `pub mod group_rooms;` in
lib.rs + ONE `.nest("/api", …)` line in main.rs; ZERO edits to
group-chat.store.ts / group-chat.types.ts (sync drives them via
setState + a store subscription); turn-runner + ShellRail edits minimal
and self-contained.

## Status: CODE COMPLETE, ALL VERIFICATION DONE
- node_modules symlinks: root + surface linked from shared checkout
  (surfaces/node_modules absent in shared — pnpm hoists to root; skipped).
- Rust `cmd/allternit-api/src/group_rooms.rs` (NEW): SQLite store
  (group_room_projections/_watermarks/_holds, per-call connections like
  DbHandle); write-time caps (16 msgs / 1200 chars / 48KB); CAS
  put_projection (409 revision_conflict w/ current_revision; tombstoned →
  409 room_tombstoned); tombstone (GET→404, tombstoning again→404,
  changes_since still surfaces); changes?since_revision (strict >);
  monotonic watermark bumps; holds create/resolve/list. Store registry
  keyed by AppState.data_dir (OnceLock<RwLock<HashMap>>) — no AppState
  struct change.
- Surface (NEW): `lib/bots/group-rooms-api.ts` (client, status-coded
  GroupRoomsApiError) and `lib/bots/group-rooms-sync.ts` (clip/merge/seed
  pure helpers; CAS push w/ pull→merge→retry-once; pull changes +
  re-seed + tombstone apply; local-disband tombstone watcher; per-member
  local watermark indexes + server mirror; needs_you holds +
  refresh/resolve; startGroupRoomsSync focus/online pulls; fail-closed on
  isRailsApiEnabled; jsdom-safe persisted storage fallback).
- Turn runner: per-member watermark-gated history (watermark 0 = legacy
  last-30), bump after reply, @user reply → createEscalationHold,
  pushGroupRoom fire-and-forget after the turn.
- ShellRail Inbox: "Group escalations" section (renders only when
  unresolved holds exist), click → onOpen('group-chat') + fire-and-forget
  resolve; sync started on mount; refresh on popover open.

## Verification (all green)
- cargo check -p allternit-api: PASS (pre-existing warnings only).
- cargo test -p allternit-api --lib group_rooms: 13/13 PASS — caps (16/1200/
  48KB/reject-blob), CAS accept/stale/absent, tombstone 404+write-reject+
  changes-surface, since_revision strict->, watermark monotonic+isolation,
  holds lifecycle, list; plus tower-oneshot HTTP round-trip (routing
  precedence /group-rooms/changes vs /:room_id, 409 shapes, 404, holds,
  watermarks).
- npx tsc --noEmit: clean on all touched files; only the known
  environmental errors remain (TerminalWorkspace/Docs/office*/sheets
  univerjs-office stale-install family in untouched files).
- npx vitest run: 170 files, 1316 passed / 1 failed / 14 skipped. Sole
  failure = fabric-session-kind.test.ts (KNOWN pre-existing, not this
  phase). New group-rooms-sync.test.ts: 20/20.
- bun run build: FAILS — environmental, NOT fixed per instructions.
  Symptom differs from p02's univerjs MISSING_EXPORT: rolldown
  UNLOADABLE_DEPENDENCY for react/react-dom from src/remote-control/
  main.tsx (secondary entry) through the worktree node_modules symlink
  chain. All 25627 modules transform (incl. every file touched here);
  failure is link-time dependency loading, unrelated to this phase.

## Open questions / notes
- Server smoke via live daemon deferred: routes sit behind the Clerk auth
  middleware; behavior covered by the in-process HTTP round-trip test.
- Watermark server mirror stores lastKnown server revision; the local
  log-index watermark is the gating source of truth (server side is a
  read-position marker).
- If build keeps failing after the shared checkout's install is refreshed,
  re-check: failure mode may revert to the known univerjs MISSING_EXPORT.
