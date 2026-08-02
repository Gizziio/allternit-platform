---
status: done
files_changed:
  - cmd/gizzi-code/src/shared/utils/settings/types.ts
  - cmd/gizzi-code/src/shared/utils/worktreeModeEnabled.ts
  - cmd/gizzi-code/src/cli/main-gizzi.tsx
  - cmd/gizzi-code/src/cli/ui/ink-app/utils/settings/types.ts
  - cmd/gizzi-code/src/cli/ui/ink-app/utils/worktreeModeEnabled.ts
  - cmd/gizzi-code/src/cli/ui/ink-app/main.tsx
  - cmd/gizzi-code/test/shared/worktreeModeEnabled.test.ts
  - docs/GIZZI_W2_NOTES.md
tests_green: true
deviations:
  - "flag.ts (GIZZI_WORKTREE) intentionally untouched: it backs run.ts's unrelated sandbox-boundary --worktree path override, not session worktree creation."
  - "Edit applied to BOTH commander forks (main-gizzi.tsx per the task's file map, ink-app/main.tsx per the steering gate). Import-graph evidence says both are unreachable from the live binary — see Findings."
remaining:
  - "Live-path wiring: the live binary (yargs src/cli/main.ts -> $0 TuiThreadCommand in src/cli/ui/ink-app/thread.ts) has no --worktree option and never calls setup(). Making R1/R2 reach real sessions requires a follow-up decision (add a worktree option to thread.ts and plumb through tui()/worker, or revive a commander main). Out of scope per task constraints."
---

# W2 — gizzi-code worktree.autoCreate setting + --no-worktree: completion notes

## What was built (spec R1–R4)

1. **Settings field (R3)** — `autoCreate: z.boolean().optional()` added to the
   `worktree` settings object, documented next to
   `symlinkDirectories`/`sparsePaths`, in BOTH manually-duplicated schema trees:
   - `cmd/gizzi-code/src/shared/utils/settings/types.ts`
   - `cmd/gizzi-code/src/cli/ui/ink-app/utils/settings/types.ts`

   Absent = default false, current behavior unchanged unless opted in.
   (Additive optional field — no backward-compatibility break; no
   `test/utils/settings/backward-compatibility.test.ts` exists in this repo.)

2. **Resolution (R1, R2)** — new pure resolver
   `resolveWorktreeEnabled(cliWorktree, cliNoWorktree, autoCreate)`:
   `--worktree` → true, else `--no-worktree` → false, else
   `settings.worktree?.autoCreate ?? false`. Exact precedence required by the
   spec. Added to both `worktreeModeEnabled.ts` copies
   (`src/shared/utils/` and `src/cli/ui/ink-app/utils/`), matching the trees'
   existing manual-duplication convention.

3. **CLI wiring** — in BOTH commander mains
   (`src/cli/main-gizzi.tsx` and `src/cli/ui/ink-app/main.tsx`):
   - Declared `--no-worktree` next to `-w, --worktree [name]` (commander maps the
     negation onto `options.worktree === false`; the positive option is declared
     first so the absent default stays `undefined`).
   - Resolution site (previously `worktreeEnabled = worktreeOption !== undefined`)
     now calls `resolveWorktreeEnabled(...)` gated on `isWorktreeModeEnabled()`,
     reading `getInitialSettings().worktree?.autoCreate` from each tree's own
     settings module. No changes to `setup.ts` or `worktree.ts` creation logic.

4. **Unit tests (R4)** — `cmd/gizzi-code/test/shared/worktreeModeEnabled.test.ts`
   (bun:test, matches `test/shared/` conventions): full R4 matrix
   (setting on → enabled; setting on + --no-worktree → disabled; setting off +
   --worktree → enabled; both absent → disabled) plus
   --worktree-beats---no-worktree, run against BOTH resolver copies, and three
   SettingsSchema cases per schema copy so the duplicated trees cannot silently
   diverge.

## Test command & output

Deps were not installed in this worktree; ran
`pnpm install --frozen-lockfile --ignore-scripts` at repo root first (exit 0,
lockfile untouched — the AGENTS.md pnpm warning did not reproduce).

```
$ cd cmd/gizzi-code && bun test test/shared --timeout 30000
 27 pass
 0 fail
 38 expect() calls
Ran 27 tests across 3 files. [1.73s]
```

(16 of the 27 are the new W2 tests — 8 per tree; the other 11 are pre-existing
`test/shared/` tests confirming no regression. Narrowest command for just the
new file: `bun test test/shared/worktreeModeEnabled.test.ts`.)

Smoke check requested by the gate: `bun run start --worktree` → the live yargs
CLI rejects it ("Unknown argument" → prints help), because the live `$0`
command (`thread.ts`) declares no `--worktree` option. This is recorded as
evidence for the finding below, not as a pass — an interactive TUI boot is not
exercisable from this environment.

## Findings (material, for the gate)

- **Both commander mains are unreachable from the live binary.** Verified by
  import graph: `src/cli/main-gizzi.tsx` has zero importers repo-wide;
  `src/cli/ui/ink-app/main.tsx` is imported only by
  `src/cli/ui/ink-app/entrypoints/cli.tsx`, which nothing imports. The only
  entrypoint of the built binary (`script/build-production.js:414`) and of
  `bun run dev/start` is yargs `src/cli/main.ts`; bare `gizzi` runs
  `TuiThreadCommand` (`thread.ts`) → `tui()` (`app.tsx`) → `<REPL>` — which
  never parses `--worktree` and never calls `setup()`. Comments referencing
  "main.tsx" describe the upstream claude-code architecture, not this repo's
  live call graph. The feature is implemented in both forks and fully
  unit-tested, but it takes effect at runtime only once a live entrypoint
  consumes it (see `remaining` in frontmatter).
- **On `main-gizzi.tsx` (gate question #4):** it is vestigial — a rebrand-era
  fork of `ink-app/main.tsx` with zero importers and several broken import
  paths (`./setup.js`, `./utils/worktreeModeEnabled.js` do not resolve). It was
  edited only because the task doc's file map names it as "the CLI entrypoint";
  `ink-app/main.tsx` now carries the identical change, so the forks do not
  diverge on this feature.
- `src/runtime/context/flag/flag.ts:87 GIZZI_WORKTREE` belongs to
  `src/cli/commands/run.ts`'s `--worktree <path>` "sandbox boundary override"
  — a different feature. Touching it would conflate the two; left alone.
