# Phase 2 — gizzi-code CLI: deterministic HTML artifact generator + publish

Read `docs/HTML_ARTIFACTS_MAP.md` and `docs/HTML_ARTIFACTS_PHASE_1_NOTES.md`
first — Phase 1 is reviewed and approved. Phase 1's NOTES file has the exact
backend contract you call against; use it, don't re-derive or guess field
names. This phase is scoped to `cmd/gizzi-code` ONLY. Do not touch
`cmd/allternit-api` or `surfaces/allternit-mobile/ios`.

## Step 0 — investigate before writing code (report findings in your NOTES
file even though this isn't a separate deliverable)

Two open questions the map doc flagged that need real answers, not
assumptions:

1. **Session context.** Phase 1's endpoint is
   `POST /api/v1/agent-sessions/:session_id/canvases` — scoped under a
   session. Does a running gizzi-code CLI process already have an
   associated `agent-session` id it can read from local state (grep for how
   `allternitApi.ts` callers or the runtime session code reference a
   session id today — e.g. `src/runtime/session/*`, anything that already
   registers a session with allternit-api)? If yes, use that real session
   id. If a bare/local CLI run has no linked agent-session at all, figure
   out the least-surprising way to still publish (e.g. does one need to be
   created, or does the backend already tolerate an arbitrary session_id
   string for this purpose — check by reading `canvas_routes.rs` yourself
   in the read-only sense, it's right there in the sibling directory of
   this worktree even though you won't edit it). Document what you found
   and what you chose.
2. **Device token source.** Phase 1 wired auth for
   `Authorization: Bearer allternit_runtime_…` tokens. gizzi-code already
   uses this same device-token mechanism for its MCP calls somewhere — find
   where (grep for `allternit_runtime_` / `DEVICE_TOKEN` / device-token
   issuance in `cmd/gizzi-code/src`) and reuse that exact same token
   source/storage. Do not implement new device-token provisioning or
   request/generate a token through some other path — if the existing MCP
   code has a gap (e.g. token only obtained in a context this new command
   doesn't have), document it precisely rather than inventing a workaround,
   and fall back to `ALLTERNIT_API_TOKEN`/desktop-bootstrap dev-fallback
   auth (already wired in `allternitApi.ts`) for now, noting it as a
   follow-up.

## Scope

### 1. Backend client — extend `src/runtime/services/api/allternitApi.ts`

Add functions to call the Phase 1 endpoints:
- `POST /api/v1/agent-sessions/:session_id/canvases` with
  `{ title, components, layout?, metadata?, artifact_key }` — this is the
  publish/redeploy call, always send full current content (Phase 1's
  upsert is full-replace, not partial — see its NOTES file, "For Phase 2"
  section, for the exact contract and why).
- `GET /api/v1/agent-sessions/:session_id/canvases` and
  `GET /api/v1/canvases/:canvas_id` as needed for listing/status.

Follow the existing style of this file (how `/tasks` and
`/automation/routines` wrappers are written — same error handling,
same `apiFetchJson` usage).

### 2. Deterministic HTML generator

A pure function: given a structured input (title, tabs/sections, status
data — design a minimal reasonable schema, you don't need to match
`project-artifact`'s exact schema, just be structured and documented) it
must produce **byte-identical HTML output for byte-identical input** —
no embedded timestamps, random ids, or non-deterministic ordering (e.g.
object key iteration order — serialize deterministically). Self-contained
output: inline CSS, minimal inline JS, no external network requests, no
CDN links, light/dark mode via `prefers-color-scheme` (study
`~/.gizzi/plugins/marketplaces/claude-plugins-official/plugins/project-artifact/template.html`
and the `frontend-design` skill for the *pattern* — distinctive, non-templated
visual design, tabs/status-pill/callout conventions — but write your own
implementation, don't copy their file verbatim; this is a different product).

### 3. New command/skill — pick a name that does NOT collide with the
existing `/artifact` TUI command (`src/cli/ui/ink-app/commands/artifact/`,
a markdown viewer — unrelated, leave it alone) or the `Artifact` type in
`src/runtime/util/artifacts.ts` (inline chat-tag parsing — also unrelated,
leave it alone). Something like `html-artifact` or `canvas-publish` — your
call, just document the name and why it avoids collision. Wire it as a
real registered command (check `src/cli/main.ts` / the command registry
convention other real commands use — not the dead `src/commands/init.ts`
pattern, follow how live commands under `src/cli/commands/` get
registered).

Command behavior: takes/produces the structured input for the generator,
generates the HTML, calls the publish endpoint with a stable `artifact_key`
(derived from something the user controls — e.g. an explicit `--key` flag
or a slug derived from title — your call, document it), reports back
whether this was a fresh publish (`version: 1`) or a redeploy
(`version > 1`) per the response.

### 4. Config store

`.gizzi/artifacts/<slug>/config.json` — primary, `.claude/artifacts/<slug>/config.json`
read-only fallback, always write to `.gizzi/`. Follow the exact idiom in
`src/shared/utils/settings/settings.ts:236-320` and
`src/shared/utils/config.ts:1790-1819` (read those functions before writing
this, match their approach, don't invent a new pattern). Store at minimum:
the `artifact_key`, the last known `canvas_id`/`version`, and whatever
generator input is needed to redeploy without re-specifying everything by
hand next time.

### 5. Skill/plugin placement

If you build this as a builtin plugin (`src/runtime/plugins/builtin/<name>/`
with `SKILL.md` + your generator's template assets co-located), that's
fine — `loadSkillsDir.ts` only requires `SKILL.md` present, co-locating
other files is structurally supported even though no existing plugin does
it today (this will be the first). If a plain TS command without the
plugin/SKILL.md wrapper is a better fit given what you find in Step 0,
that's fine too — use your judgement, just document which you chose and
why in NOTES.

## Constraints

- No changes to `cmd/allternit-api` or `surfaces/allternit-mobile/ios`.
- Run `git status --porcelain` before starting and check `git diff main
  --stat` covers only files you intend, right before writing your NOTES —
  Phase 1 hit a case where `main` moved forward from a concurrent session
  mid-work; if that happens again, merge `main` into your branch the same
  way (fast-forward if you have no local commits, otherwise a real merge)
  rather than treating it as your own scope creep.
- Actually build and run it: `bun` build/typecheck for the package, and
  actually invoke the new command against a locally running
  `allternit-api` (built from this same worktree — Phase 1's backend
  changes are right there) to confirm a real publish round-trips: generate
  → publish → confirm via `GET /canvases/:canvas_id` (or the list endpoint)
  that the content, `artifact_key`, and `version` are what you expect.
  Then republish the *same* `artifact_key` with different content and
  confirm `version` incremented and it's still one row, not two — this is
  the actual feature, don't skip verifying it end-to-end just because
  Phase 1 already verified the backend half in isolation.
- Match repo idiom throughout (import style, error handling, naming) —
  read a few neighboring real commands before writing new ones.

## Deliverable

`docs/HTML_ARTIFACTS_PHASE_2_NOTES.md`, same frontmatter contract as
Phase 1 (`status`, `files_changed`, `deviations`, `remaining`), then prose:
the two Step-0 investigation answers, the command name and how to invoke
it, the generator's input schema, the config file shape, and your
end-to-end verification transcript (actual commands/output, not
"should work"). Do not start Phase 3 (iOS). That file existing = phase
done.
