# Attestation — session/nsreaders-20260908

**Date:** 2026-09-09 (local)
**Agent family:** kimi-code (session cde4a23f)
**PR:** #183, merged `20b3d0dda`
**Topic:** native-sessions registry follow-up — cline/amp store readers

## What was done

Honest follow-up #1 from the native-sessions verification (PR #172): `aider`, `cline`,
`amp`, and `kiro` were registered in `HARNESSES` (visible in
`/v1/native-session/harnesses`) but had no `catalog.ts` reader, so they never appeared in
`/v1/native-session/list`.

- **cline** — full support: `listCline` reads the VS Code extension store
  (`tasks/<taskId>/api_conversation_history.json`, OpenAI-style history + `ui_messages.json`);
  `projectCline` projects messages / `tool_calls` / `tool`-role results into inert portable
  events; `exportCline` writes a new task directly (session-migrate has no cline target).
  Registry: `projectable: true`, resumeHint points at reopening the task in VS Code.
- **amp** — full support: `listAmp` reads `~/.local/share/amp/threads/T-*.json`
  (`{messages: [...]}` Anthropic-style blocks); `projectAmp` projects text / `tool_use` /
  `tool_result` blocks; `exportAmp` writes a new `T-<uuid>.json` thread directly. Registry:
  `projectable: true`, resumeHint `amp threads continue <id>`.
- **aider** — deliberately stays registry-only: `~/.aider` holds no session store
  (analytics/caches only, verified on this machine); aider chat history is the per-project
  `.aider.chat.history.md` file with no session ids, so there is nothing enumerable.
- **kiro** — deliberately stays registry-only: IDE chat files under
  `User/globalStorage/kiro.kiroagent` are undocumented and have changed shape between
  releases (crash-recovery reports); implementing a reader against a moving, undocumented
  format would violate the no-guesses discipline.

Result: **25 of 27** registered adapters now have store readers (was 23).

## How it works

Readers and projectors live in `packages/@allternit/native-sessions` (`catalog.ts`,
`project.ts`, `export.ts`, `harness.ts`), following the existing per-harness switch
precedent (grok/kimi/cursor). Cline task dirs and amp thread JSON files are both
directory-reader harnesses; fingerprints hash the origin files so pickup/fetch divergence
detection works unchanged.

## Verification evidence

- `bun test src/` in `packages/@allternit/native-sessions`: **11/11 pass** (3 new catalog,
  2 new projector, 1 new export round-trip), run before merge and again after rebase.
- `tsc --noEmit` in `cmd/gizzi-code`: **exit 0** (first attempt masked the exit code via a
  pipe; re-run with explicit `TSC_EXIT=0`).
- Live HTTP smoke from worktree source (`bun run start serve --port 4198`) with a fixture
  `HOME`: `GET /v1/native-session/list?harness=cline|amp` returned titled sessions;
  `GET /show/cline/task-4711` and `/show/amp/T-smoketest-0001` returned correct inert
  portable events (message / tool_call / tool_result). Against the real home, all four
  harnesses return `{"sessions":[]}` with 200 — correct, since none of the four stores
  exist on this machine.

## Honest deferrals

- **cline/amp readers are fixture-tested, not live-verified.** No fleet machine currently
  has a Cline or Amp store, so the readers have not run against real tool output. The docs
  (`docs/NATIVE_SESSIONS.md`, `docs/public/tools/native-sessions.md`) state this explicitly.
- **Follow-up #2 (Desktop 1.1.1 release CI) is NOT closed by this session.** It is owned by
  `session/relfix6-20260908` (active; its PRs #156/#159/#162/#163/#165/#166/#169/#181/#182
  are the release repair series). Release run 7 (`34298095211`, after PR #169) failed: the
  Windows api build hit `cannot find macro warn in this scope` in Incus/Tart provider init
  (cfg-gated import gap — PR #169 gated the socket transport but provider init code paths
  still reference `warn!` on Windows) and the macOS job failed at electron-builder
  packaging (PR #182 subsequently addressed notarization secrets on CI). Left to that
  session to avoid double-fixing; this session only armed a run watcher and reported.
- Vercel PR checks failed with deployment rate-limiting (infra, unrelated to the diff).

## Incidents

- Rebase onto `origin/main` conflicted only in `.steering/checkpoint.md` (transient,
  last-writer-wins steering file also updated by session cu17-creds); resolved taking this
  session's checkpoint.
- Local `pnpm install` in the fresh worktree dirtied `pnpm-lock.yaml` (dropped one empty
  importer entry); reverted — not part of this change.
