# Steering spec — HTML Artifacts, Phase 2 (gizzi-code CLI)

<!-- The SOURCE OF TRUTH for what "done" means. Write this BEFORE or AT THE START
     of the work (whoever scopes the feature — you or the working agent), and keep
     it current as scope decisions change. The steering agent maps every
     requirement below to DONE / PARTIAL / MISSING with code evidence at each
     checkpoint. Vague requirements get vague verdicts: make each one checkable. -->

Scope: `docs/HTML_ARTIFACTS_PHASE_2_TASK.md`, `cmd/gizzi-code` only. See
`docs/HTML_ARTIFACTS_MAP.md` for the full 4-phase picture. Phase 1 (backend,
`cmd/allternit-api`) is reviewed and approved — see
`docs/HTML_ARTIFACTS_PHASE_1_NOTES.md` for its spec/acceptance history and
the route contract this phase calls against. Phase 3 (iOS), Phase 4 (e2e) are
each their own future checkpoint, not in scope here.

## Requirements

- [x] R1: Step 0 investigated (not assumed) where a running gizzi-code
      process gets a session id for the canvas endpoint, and where its
      existing device-token mechanism lives — both documented with real
      findings (including that the "MCP calls already use this token" premise
      didn't hold up) in PHASE_2_NOTES.md.
- [x] R2: `allternitApi.ts` extended with `publishApiCanvas`/`listApiCanvases`/
      `getApiCanvas` matching Phase 1's exact route contract (paths, field
      names, `/api/v1` prefix), same style as existing `/tasks`/`/automation`
      wrappers.
- [x] R3: A pure `generateArtifactHtml(input)` function — byte-identical
      output for byte-identical input, no timestamps/random ids/object-key-
      order dependence, self-contained (inline CSS/JS, no external requests),
      light/dark via `prefers-color-scheme`.
- [x] R4: A real registered CLI command (not a dead/unwired file) that
      generates + publishes with a stable `artifact_key`, reports
      published-vs-redeployed per the response `version`, named to avoid
      both documented collisions (`/artifact` TUI viewer, `Artifact` chat-tag
      type).
- [x] R5: Config store at `.gizzi/artifacts/<slug>/config.json` (primary,
      always written) / `.claude/artifacts/<slug>/config.json` (read-only
      fallback), following the exact idiom in `settings.ts`/`config.ts`
      (`pickMemoryFile`-style precedence), storing enough to redeploy without
      re-specifying everything by hand.
- [x] R6: Actually built/typechecked, and actually invoked against a real
      locally-running `allternit-api` (built from this worktree) — publish →
      confirm via GET, republish same `artifact_key` with different content →
      confirm `version` incremented and still one row (not two).

## Out of scope

- `cmd/allternit-api` and `surfaces/allternit-mobile/ios` — Phase 1
  (approved, done) and Phase 3 (future).
- Matching `project-artifact`'s exact generator schema — a self-documented,
  minimal-but-real schema is enough per the task doc.
- Getting the full interactive TUI CLI (`bun ./src/cli/main.ts`) to boot in
  this worktree — pre-existing, unrelated missing dependencies block that
  (see PHASE_2_NOTES.md "remaining"); verification instead calls the real
  exported command handlers directly, which is the actual code under review
  here (argv parsing itself is 3 lines of yargs wiring).
- Exercising the device-token auth path through an actually-paired device —
  this dev machine isn't paired, and fabricating a fake `runtime-device.json`
  in the real global data dir to simulate one was judged too risky (could
  corrupt real local pairing state). The unpaired fallback path is verified;
  Phase 1 already proved the backend side of device-token auth end to end.

## Acceptance

- Typecheck (`~/.gizzi/node_modules/.bin/tsc --noEmit`, this worktree's own
  `node_modules` lacking a local `tsc`): zero errors in any file this phase
  touched or added; the 113 pre-existing errors elsewhere are all unrelated
  (missing axios/yaml/sharp type declarations, an unrelated `figures` API
  mismatch, one unrelated ArrayBuffer strictness issue).
- Generator determinism: two calls with a `structuredClone`d-identical
  `ArtifactInput` produced byte-identical HTML strings.
- End-to-end, against a real `allternit-api` instance built from this
  worktree: publish (new artifact) → `version: 1`; redeploy same `--key`,
  no `--input` (reuses saved input) → same canvas id, `version: 2`; redeploy
  same `--key` with different content → same canvas id, `version: 3`,
  content actually changed. Confirmed independently via direct `curl` +
  `sqlite3` against the backend (not just trusting the CLI's own report):
  exactly one row for that session, final version 3, content matching the
  latest input. Config-file contents, error messages for missing
  `--input`/unknown `--key`, and `.gizzi`/`.claude` fallback precedence all
  verified directly.
