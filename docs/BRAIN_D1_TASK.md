# D1 TASK — gizzi brain init

You are the executor. `.steering/spec.md` (D1-R1..R4, canonical brain layout,
acceptance) is the source of truth. This is the first brain-era product
feature: a `gizzi brain` command group in cmd/gizzi-code.

## Workflow rules

1. Update `.steering/checkpoint.md` at checkpoints; [steering] is authoritative.
2. Done → `docs/BRAIN_D1_NOTES.md` with YAML frontmatter, then
   `touch docs/BRAIN_D1_NOTES.sentinel`.
3. Then commit: `git add cmd/gizzi-code .steering docs && git commit -m "feat(gizzi-code): gizzi brain init — second-brain creation (D1)"`.
   A gate reviews; fix and retry if blocked.

## Build guidance

1. First read how commands are registered in cmd/gizzi-code (W2/W2b territory:
   src/cli/main-gizzi.tsx commander path AND the live yargs path in
   src/cli/ui/ink-app/thread.ts + nearby command modules). Register `gizzi brain`
   on the LIVE path (the W2b finding: commander path is unreachable).
2. `gizzi brain init [--path <dir>] [--force]`:
   - Creates the canonical layout from the spec (brain.yaml, identity.md,
     domains/, decisions/, runbooks/, ideas/, MEMORY.md) with valid
     frontmatter in every template (type/status/domain per the C2 convention),
     git init + initial commit.
   - Refuses to overwrite a non-empty existing brain unless --force.
3. `gizzi brain` (status): path, remote configured?, uncommitted changes,
   unpushed commits — plain text, exit 0.
4. `gizzi brain sync`: git pull --rebase then push when a remote is
   configured; conflicts surface as plain instructions (never auto-resolve);
   no remote = friendly message, exit 0.
5. R3 wiring: write the brain path into the user's gizzi settings (find the
   settings module W2 used — add a `brain.path` field to the settings schema,
   documented) so the agent layer can find it; MEMORY.md in the brain
   explains to agents what the brain is and how to read it.
6. R4 (`--remote`): PROVISIONING endpoint does not exist yet (D2) — implement
   the flag to call `POST /api/v1/brains` and, on 404/connection failure,
   print "platform remotes land in D2; run `gizzi brain remote <url>` later"
   and exit 0. Add `gizzi brain remote <url>` to set origin manually.
7. Tests: init creates conforming layout (frontmatter validated by parsing);
   refuses non-empty without --force; status output fields; sync no-remote
   path. Match existing test conventions; run the narrowest command, record
   output in NOTES.

## Constraints

- Surgical: new brain command module(s) + settings schema field + registration
  on the live path. No changes to W2/W2b worktree code or thread.ts beyond
  command registration if needed.
- Templates must be genuinely useful (a real identity.md prompt structure,
  a real runbook template) — not lorem ipsum.
