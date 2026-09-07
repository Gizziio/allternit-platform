# 2026-09-06-2218 — Grok-Parity Slash Commands (session 88f19eb6, kimi)

## What was done

Completed the Grok CLI slash-command port into gizzi-code on top of a748ccb78
(first pass: /history, /edit-prompt, /timestamps, /always-approve, /auto,
/remember, /view-plan + source badges, committed 21:31 same day by a parallel
effort in the main checkout).

Branch `session/grok-slash`, worktree `allternit-session-grok-slash`, base 441ed7495.

### Feature commit df9ed4c3c

New commands (all registered in `src/cli/ui/ink-app/commands.ts`, live tree only):

- `/session-info` — Ink panel: model, cwd, project dir, session id, context-window
  bar; `c` copies session id (`setClipboard` from `ink/termio/osc.js`; the plan's
  `util/clipboard.ts` does not exist in this tree).
- `/recap` — inline session-summary prompt command.
- `/queue` — immediate (runs mid-turn) read-only view of `getCommandQueueSnapshot()`.
- `/transcript` — opens transcript in `$PAGER`/`less -R`; shared `runInPager`
  helper extracted into `utils/editor.ts`.
- `/multiline` (`/ml`) — global-config toggle swapping Enter semantics in
  `useTextInput.handleEnter`; threaded PromptInput → TextInput → hook.
- `/cd` — `setCwd()` switch for tool execution/statusline; deliberately does NOT
  re-anchor the transcript dir (`setOriginalCwd` untouched).
- `/fork [--worktree|--no-worktree] [directive]` — FORK_SUBAGENT-gated peer-agent
  spawn: `buildForkedMessages` seed, optional `createAgentWorktree`, `runAgent`
  with `useExactTools`/`forkContextMessages` for prompt-cache parity, best-effort
  `registerRailsPeer`, completion report via `enqueuePendingNotification`.
- `/rename --auto` forces auto-title generation.
- `/clear` description advertises `/new` (alias already existed).

Menu/presentation:

- `recordSkillUsage` no longer gated to `type:'prompt'` — all user-invocable
  commands accumulate MRU (persistence via global config unchanged).
- `findDisabledCommand` in commands.ts: gated commands now get an explanatory
  message (availability → hint `/login` or `/model`; disabled → "turned off")
  instead of `Unknown skill`.

Also fixed in a748ccb's code: `/auto` called `feature()` inside an arrow body,
which `bun:bundle` rejects — evaluated once via ternary instead.

### Supporting commits

- a63aecd1c — fix(native-sessions): base commit 441ed7495 re-exported
  `HARNESS_BY_ID` without importing it; broke `tsc --noEmit` workspace-wide.
- a18be47d3 — chore: pnpm-lock.yaml was stale vs package.json since 441ed7495
  (missing `@allternit/native-sessions` workspace entry); regenerated.

## Verification

- `bun run typecheck` (cmd/gizzi-code): EXIT=0.
- `bun test --preload ./test/preload.ts test/commands/slash-menu.test.ts
  test/commands/timestamps.test.ts test/commands/rename.test.ts`:
  12 pass, 0 fail (incl. new slash-menu badge cases + rename --auto test).
- Not verified live: `/fork` runtime spawn (FORK_SUBAGENT off in dev builds —
  verified by construction/typecheck only); `/transcript` pager needs a real TTY.

## How it works (integration contract)

New built-in = `commands/<name>/index.ts` exporting a `Command` → import in
`commands.ts` → `COMMANDS` array. Dispatch, `/help`, and autocomplete pick it
up via `getCommands()`; no dispatcher changes needed. Dead trees
(`src/cli/ui/components/`, `src/commands/`, `src/shared/utils/processUserInput/`)
were not touched.

## Unfinished / deferred

- `/timestamps` rendering, `/always-approve`, `/auto` — done by a748ccb (not
  re-verified beyond the /auto build fix and unit tests).
- Plan's deferred items remain deferred: permission-mode toggles design pass,
  `/minimal`/`/fullscreen` render modes.
- Cleanup decision pending: `/status` also carries the `session-info` alias from
  a748ccb — dedicated `/session-info` panel wins deterministically (earlier in
  COMMANDS); harmless duplication.
- Worktree/branch not deleted — awaiting merge to canonical branch.

## Environment notes

- `allternit-gizzi-p5-rebrand-legal-20260904` checkout is ORPHANED: its
  `.git` file points to `.git/worktrees/allternit-gizzi-p5-rebrand-legal-20260904`
  which does not exist in the main repo; no git operations work there and its
  gizzi-code tree is stale (Sep 4, pre-dates a748ccb). Needs repair or deletion.
- Another agent session is actively committing to `feat/desktop-apps-extensions`
  in the main checkout (a748ccb 21:31, 441ed7495 21:34 — during this session).
  Rebase `session/grok-slash` onto latest before merging.
