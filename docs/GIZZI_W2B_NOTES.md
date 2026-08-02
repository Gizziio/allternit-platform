---
status: done
files_changed:
  - cmd/gizzi-code/src/cli/ui/ink-app/thread.ts
  - cmd/gizzi-code/src/cli/ui/ink-app/threadWorktree.ts
  - cmd/gizzi-code/test/cli/thread-worktree.test.ts
  - docs/GIZZI_W2B_NOTES.md
tests_green: true
deviations:
  - "Resolution adapter is a new pure module (threadWorktree.ts) instead of inlining in thread.ts: yargs collapses --worktree/--no-worktree into one boolean|undefined value, and the adapter maps it onto resolveWorktreeEnabled's (cliWorktree, cliNoWorktree) pair. Kept pure (settings read at the thread.ts call site, same as the commander mains) so unit tests don't import the settings graph."
  - "thread.ts now calls setCwd(cwd) + setOriginalCwd(cwd) right after the project-dir chdir (before resolution): project/local settings resolve against getOriginalCwd(), so without this worktree.autoCreate in the project dir was never seen when a [project] arg was given. tui() sets the same state to the same value at startup; this only makes it visible earlier."
  - "The worktree block calls enableConfigs() + shared enableConfigs() before createWorktreeForSession: worktree creation reads config (symlink/sparse settings) and config access throws 'Config accessed before allowed' until enabled. Both are idempotent and tui() calls them again later."
remaining:
  - "Live path accepts --worktree/--no-worktree as booleans only — no optional worktree name, no --tmux, no --pr (the commander path's -w [name] / tmux / PR-number inputs have no yargs counterparts here). Slug is always getPlanSlug()."
  - "Early-return error paths in thread.ts (pre-existing --fork path and the new worktree errors) leave the process alive in a non-TTY environment because middleware-initialized handles keep the event loop up; pre-existing behavior, verified identical on the --fork path."
---

# W2b — wire worktree.autoCreate into the live session path: completion notes

## What was built (spec R1–R4)

1. **CLI flags (R2)** — `TuiThreadCommand` (`src/cli/ui/ink-app/thread.ts`)
   gains a boolean `worktree` option. yargs boolean negation (on by default)
   makes `--worktree` parse to `true`, `--no-worktree` to `false`, absence to
   `undefined` — one declaration, both spellings accepted under `.strict()`.
   Previously `--worktree` was rejected as "Unknown argument" (W2 smoke
   finding); it now appears in `--help` and parses.

2. **Resolution (R1)** — new adapter
   `src/cli/ui/ink-app/threadWorktree.ts` → `resolveSessionWorktreeEnabled(
   worktreeFlag, autoCreate)`: maps yargs' single value onto the W2
   resolver's pair (`worktreeFlag === true` → cliWorktree,
   `worktreeFlag === false` → cliNoWorktree) and gates on
   `isWorktreeModeEnabled()` — exactly the commander path's expression.
   thread.ts supplies `getInitialSettings().worktree?.autoCreate` at the call
   site, mirroring main-gizzi.tsx:1165 / ink-app/main.tsx:1167. The W2
   modules (`worktreeModeEnabled.ts`, both copies) are untouched.

3. **Live-path wiring** — thread.ts handler, after the project-dir
   `process.chdir(cwd)` and BEFORE the worker spawn / `tui()`:

   - `setCwd(cwd)` + `setOriginalCwd(cwd)` so settings (`getOriginalCwd()`
     -rooted) and `getCwd()`-based helpers see the project dir. tui()
     (`app.tsx:22-24`) sets the same state to the same value at startup, so
     this changes nothing for the non-worktree path.
   - When resolution enables creation, the SAME native worktree branch as
     `src/cli/ui/ink-app/setup.ts:177-286` runs inline:
     `enableConfigs()` + shared `enableConfigs()` (idempotent; required —
     worktree creation reads config and config access throws before
     enablement) → `captureHooksConfigSnapshot()` → `hasWorktreeCreateHook()`
     / `getIsGit()` validation (same error messages, via thread.ts's
     console.error + exitCode + return idiom) → canonical-main-repo resolve
     (`findCanonicalGitRoot` / `findGitRoot`) → `createWorktreeForSession(
     getSessionId(), getPlanSlug())` → `process.chdir` into the worktree →
     `setCwd` / `setOriginalCwd` / `setProjectRoot` → `saveWorktreeState` →
     `clearMemoryFileCaches` → `updateHooksConfigSnapshot()` →
     `logEvent('tengu_worktree_created', { tmux_enabled: false })`.
   - Because this runs before `new Worker(...)` and `tui()`, the worker and
     the REPL both start inside the worktree; the REPL observes it through
     the same `utils/worktree` module state + `saveWorktreeState`
     persistence it already reads (`getCurrentWorktreeSession`,
     `REPL.tsx:314`).

## Structural mapping (task guidance §3)

The commander path passes `worktreeEnabled` INTO `setup(...)`; the live path
never calls `setup()` at all (its session is implicit: bootstrap-state
session id + in-process query loop). So instead of forcing a setup() call
into thread.ts, the worktree branch of setup() runs inline in thread.ts at
the equivalent lifecycle point — post-chdir, pre-worker, pre-TUI. Omitted
inputs that have no live-path counterpart: worktree name (commander's
`-w [name]`), tmux, PR number. Worktree creation internals unchanged.

## Tests (R3, R4)

New: `cmd/gizzi-code/test/cli/thread-worktree.test.ts` (bun:test, relative
imports, per `test/cli` conventions) — full flag × setting matrix through
the live-path adapter, proving the parsed flag value reaches
`resolveWorktreeEnabled` with the right mapping:

```
$ cd cmd/gizzi-code && bun test test/shared test/cli/thread-worktree.test.ts --timeout 30000
 33 pass
 0 fail
 44 expect() calls
Ran 33 tests across 4 files. [1.59s]
```

(6 new W2b tests + 27 pre-existing `test/shared` tests incl. the 16 W2
tests — R4, no regression. Narrowest command for the new file:
`bun test test/cli/thread-worktree.test.ts`.)

Deps were absent in this worktree; ran
`pnpm install --frozen-lockfile --ignore-scripts` at repo root first
(exit 0, lockfile untouched — same as W2).

## End-to-end smoke (live binary path, `bun run start`)

Non-TTY environment, so the TUI itself can't render (Ink raw-mode error is
the expected end state of a successful boot); worktree creation is the
observable. Verified against throwaway repos in /tmp (cleaned up after):

- `gizzi --worktree <non-git dir>` →
  `Error: Can only use --worktree in a git repository, but ...` (parity with
  setup.ts) — flag parsed, native path activated, correct refusal.
- `gizzi --worktree <git repo>` → `.claude/worktrees/<slug>` created with
  branch `worktree-<slug>` (`git worktree list` confirms), boot proceeds.
- Acceptance scenario 1: `<repo>/.claude/settings.json` =
  `{"worktree": {"autoCreate": true}}`, no flags → worktree created.
- Acceptance scenario 2: same repo + `--no-worktree` → NO worktree; session
  boots in the main repo.

## Findings

- `getInitialSettings()` roots project/local settings at
  `getOriginalCwd()`, which thread.ts never set before `tui()` — the
  `setCwd(cwd)`/`setOriginalCwd(cwd)` addition above is required for
  autoCreate to work when a `[project]` arg (or `--cwd`) differs from the
  launch dir.
- `createWorktreeForSession` reads global config mid-creation
  (`Config accessed before allowed` throw) — the commander path never hits
  this because its config is enabled earlier; on the live path the config
  enablers must run first (both are idempotent).
- yargs `--no-<bool>` negation is what satisfies R2's "both options"; there
  is no separate `no-worktree` declaration, matching yargs idiom.
