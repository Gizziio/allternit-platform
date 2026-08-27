---
status: done
files_changed:
  - cmd/gizzi-code/src/cli/commands/brain/index.ts
  - cmd/gizzi-code/src/cli/commands/brain/lib.ts
  - cmd/gizzi-code/src/cli/commands/brain/init.ts
  - cmd/gizzi-code/src/cli/commands/brain/status.ts
  - cmd/gizzi-code/src/cli/commands/brain/sync.ts
  - cmd/gizzi-code/src/cli/commands/brain/remote.ts
  - cmd/gizzi-code/src/cli/commands/brain/memory.ts
  - cmd/gizzi-code/src/cli/commands/brain.ts
  - cmd/gizzi-code/src/shared/utils/settings/types.ts
  - cmd/gizzi-code/src/cli/ui/ink-app/utils/settings/types.ts
  - cmd/gizzi-code/test/cli/brain.test.ts
  - cmd/gizzi-code/AGENTS.md
  - docs/pipeline/bin/wiki-ingest.sh
  - docs/pipeline/bin/taste-ingest.sh
  - docs/BRAIN_D1_NOTES.md
tests_green: true
deviations:
  - "Pre-existing `gizzi brain` (BrainService triple-store memory: status/remember/recall/entities/sync/forget) collided with the D1 command group. It is preserved verbatim as `gizzi brain memory [action]`; bare `gizzi brain` now reports second-brain repo status per D1-R2, and `gizzi brain sync` is git sync — the old BRAIN.md sync moved to `gizzi brain memory sync`."
  - "MEMORY.md ships without frontmatter: the spec's canonical layout assigns frontmatter to corpus pages but not to MEMORY.md, which is the AGENTS.md-style index/entry point, not a corpus page. Tests validate frontmatter on every template page that carries it."
  - "`init --remote` sends no auth credentials: the D2 API (incl. its auth shape) does not exist yet; the call always lands on the fallback path today and the flag degrades to the D2 message with exit 0 as specified."
  - "Smoke test wrote `brain.path` into the real user settings file (~/.gizzi/settings.json) via the production code path, then the key was removed again to leave the machine as found."
remaining:
  - "D2: hosted remotes (`POST /api/v1/brains`, git smart-HTTP, git credential type) in cmd/allternit-api. Until then `init --remote` prints the fallback message."
  - "Track-D backlog (out of D1 scope): optional `--import` from a legacy allternit-brain; the legacy default remains as a fallback in the ingest scripts' brain-path resolution."
---

# D1 — gizzi brain init: completion notes

## What was built (spec D1-R1..R4)

1. **`gizzi brain` command group on the live path (R1, R2).** New directory
   `cmd/gizzi-code/src/cli/commands/brain/` registered through the existing
   `.command(BrainCommand)` line in the live yargs entry `src/cli/main.ts`
   (bin/gizzi imports it; the commander `main-gizzi.tsx` path is dead per the
   W2b finding). Import specifier `@/cli/commands/brain` now resolves to
   `brain/index.ts`, so `main.ts` itself is untouched.
   - `index.ts` — group; bare `gizzi brain` runs status (`status` is the
     group's `$0` default command).
   - `lib.ts` — all core logic, deliberately free of UI/settings imports so
     tests drive it directly. Git via `Bun.spawn` arg arrays (no shell
     interpolation).

2. **`gizzi brain init [--path <dir>] [--force] [--remote]` (R1, R3, R4).**
   Creates the canonical layout v1 (brain.yaml, identity.md, MEMORY.md,
   `_template.md` in each of domains/, decisions/, runbooks/, ideas/),
   git-init, one initial commit ("Initialize second brain (gizzi brain
   init)"). Refuses a non-empty target unless `--force`; an existing *empty*
   directory is fine. Commit identity falls back to a repo-local
   `Gizzi Brain <brain@gizzi.local>` only when neither repo nor global git
   config provides one. Templates are real working documents (identity
   prompt structure, decision/runbook/idea lifecycle guidance), not lorem
   ipsum; frontmatter follows the C2 convention (type/status/domain, plus
   `date` on decisions) so the taste engine's wiki connector ingests any
   brain with zero adapter work.
   - R3 wiring: on success the brain path is written to user settings as
     `brain.path` via `updateSettingsForSource('userSettings', ...)`, and
     MEMORY.md explains to agents what the brain is, how to read it
     (identity → domains → decisions/runbooks/ideas), and how to write.
     The consumption half of R3 lives in the pipeline: both ingest scripts
     (`docs/pipeline/bin/wiki-ingest.sh`, `docs/pipeline/bin/taste-ingest.sh`)
     resolve the brain path as `$TASTE_BRAIN` → gizzi settings `brain.path`
     → `~/brain` (when it exists) → legacy `~/Desktop/allternit-brain`
     fallback, so a brain created by `gizzi brain init` is ingested with no
     manual env wiring while legacy setups keep working. (Added in response
     to the steering gate's D1-R3 block; see Findings.)
   - R4: `--remote` POSTs `getApiUrl("/api/v1/brains")`. The endpoint is D2
     and does not exist; on 404/network failure the command prints
     "platform remotes land in D2; run `gizzi brain remote <url>` later"
     and exits 0. If it ever returns a clone URL, origin is configured.

3. **`gizzi brain` / `gizzi brain status` (R2).** Prints path, remote
   (or "none"), uncommitted change count (+ up to 10 porcelain lines),
   unpushed commits ("n/a (no remote)" when origin is unset — so a fresh
   init reports clean, per the acceptance scenario), and a Clean/Not-clean
   footer. Plain text, exit 0, friendly guidance when no brain exists.
   Path resolution: `--path` flag → settings `brain.path` → `~/brain`.

4. **`gizzi brain sync` (R2).** `git pull --rebase` then `git push`. No
   remote → friendly message, exit 0. Dirty tree → commit instructions,
   exit 1. Rebase conflict → numbered plain instructions (fix files, add,
   `rebase --continue`, re-run sync; or `--abort`), never auto-resolved.
   Pull/push failures surface git's own output plus a re-run hint.

5. **`gizzi brain remote <url>` (R4 fallback path).** Sets origin (add or
   set-url), records the URL in brain.yaml's `remote:` field, and commits
   that metadata change so the repo stays clean for `sync`.

6. **Settings schema (R3).** `brain.path` added next to `worktree` in BOTH
   manually-duplicated schema trees
   (`src/shared/utils/settings/types.ts`,
   `src/cli/ui/ink-app/utils/settings/types.ts`), documented in the
   `.describe()`. A schema test parses `{ brain: { path } }` against both
   copies so the trees cannot silently diverge (same guard pattern W2 used
   for `worktree.autoCreate`).

7. **Old command preserved.** `src/cli/commands/brain.ts` (BrainService
   memory) moved to `brain/memory.ts` with its logic verbatim; only the
   command name (`brain [action]` → `memory [action]`), describe string,
   and examples changed.

## Test command & output

Deps were not installed in this worktree; ran
`pnpm install --frozen-lockfile --ignore-scripts` at repo root first
(exit 0, lockfile untouched — same as W2).

```
$ cd cmd/gizzi-code && bun test test/cli/brain.test.ts --timeout 30000
 11 pass
 0 fail
 54 expect() calls
Ran 11 tests across 1 file. [2.23s]
```

Pipeline suites after the D1-R3 ingestion bridge (both green):

```
$ bash docs/pipeline/bin/wiki-test.sh    → All checks passed. (exit 0)
$ bash docs/pipeline/bin/taste-test.sh   → All checks passed. (exit 0)
```

Brain-path resolution verified directly against `resolve_brain` extracted
from the scripts: settings `brain.path` wins → `~/brain` fallback → legacy
`~/Desktop/allternit-brain` fallback → explicit `TASTE_BRAIN` override wins.

Covers: canonical layout + frontmatter parsed by gray-matter for every
template page (types identity/domain/decision/runbook/idea; status+domain
present; decision has a real date), brain.yaml metadata, exactly one
initial commit, clean status after init (acceptance scenario), init into an
existing empty dir, refusal of non-empty without --force (+ success with
--force), status dirty detection, missing brain, sync no-remote, sync dirty
refusal, `remote` sets origin and keeps the repo clean, template
determinism under a fixed clock, settings schema acceptance in both trees.

## Live-path smoke (real binary)

```
$ bun --conditions=browser ./src/cli/main.ts brain --help
Commands:
  gizzi brain status           Show brain status (default)          [default]
  gizzi brain init             Create a second brain (git repo of frontmatter markdown)
  gizzi brain sync             Sync the brain with its remote (git pull --rebase, then push)
  gizzi brain remote <url>     Set the brain's git origin to <url> (manual; hosted remotes land in D2)
  gizzi brain memory [action]  Legacy triple-store memory (BrainService) — remember/recall/entities

$ bun run src/cli/main.ts brain init --path $TMP/brain
🧠 Brain created at …/brain
  Initial commit: 6e5a575
  (also verified: brain.path written to ~/.gizzi/settings.json via the
   production settings path; key removed afterwards)
```

Bare status, sync, remote, and the legacy subcommand were verified on the
same binary (all exit 0 where specified):

```
$ bun run src/cli/main.ts brain --path $TMP/brain
Brain status
  Path:                …/brain
  Remote:              none
  Uncommitted changes: none
  Unpushed commits:    n/a (no remote)
  Clean.

$ bun run src/cli/main.ts brain sync --path $TMP/brain
Brain at …/brain has no remote configured — nothing to sync.
Set one with `gizzi brain remote <url>` (hosted platform remotes land in D2).

$ bun run src/cli/main.ts brain remote https://example.invalid/brain.git --path $TMP/brain
✅ Brain remote set: https://example.invalid/brain.git

$ bun run src/cli/main.ts brain memory --help   # legacy command intact
```

One real bug was caught by this smoke: the status handler originally
returned without `process.exit`, and the CLI's open DB/telemetry handles
kept the event loop alive (hang). Fixed by exiting explicitly, matching the
existing `commands/status.ts` convention.

## Findings (material, for the gate)

- **Naming collision resolved by nesting, not removal.** The pre-D1
  `gizzi brain` (BrainService) was registered on the live path. D1-R2 makes
  bare `gizzi brain` the repo status, so the old UX necessarily moved to
  `gizzi brain memory …`. Nothing else in the repo invokes the old spellings
  (grep: only docs and its own file); cmd/gizzi-code/AGENTS.md was updated.
- **Settings trees are write-compatible.** Both duplicated trees resolve
  user settings to the same file; init writes through the ink-app copy (the
  live CLI's tree) and the schema field exists in both.
- **`--remote` is intentionally a stub-shaped integration**: endpoint URL is
  the only D2 contract it assumes (`POST /api/v1/brains`, JSON response with
  `clone_url` or `url`); no auth is attached because D2 owns that decision.
- **Steering gate, round 1: blocked on D1-R3.** The gate verified R1/R2/R4
  as done (re-ran the bun suite itself: 11/11) but found the R3 purpose
  ("so the taste corpus / wiki connector can ingest it") unmet: the brain's
  default (`~/brain`) and the ingest scripts' default
  (`~/Desktop/allternit-brain`) pointed at different directories with
  nothing bridging them — silent non-ingestion for any user who inits a
  brain and runs the pipeline. Fixed as recommended: both ingest scripts
  now resolve the brain path via `resolve_brain()` (explicit `TASTE_BRAIN`
  → gizzi settings `brain.path` → existing `~/brain` → legacy
  allternit-brain fallback), python3 for settings parsing (already a
  taste-ingest.sh dependency). The legacy fallback is retained rather than
  replaced because Track D keeps allternit-brain as-is; pipeline suites
  re-run green after the change.
