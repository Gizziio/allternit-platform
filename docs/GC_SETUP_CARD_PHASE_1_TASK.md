# GC Setup Card — Phase 1 Task (only phase — read GC_SETUP_CARD_MAP.md first)

You are executing inside `/Users/macbook/Desktop/allternit-workspace/allternit`. Read
`docs/GC_SETUP_CARD_MAP.md` in full before starting.

## Constraints

- **No dev servers, no `npm run build` / `pnpm build` / `vite` / `tsc`.** A single-file esbuild
  syntax check (see below) is your own verification step and is expected.
- **No git operations** — the orchestrator handles git.
- Only edit `surfaces/ai.allternit.com/src/views/settings/AgentOpsPanel.tsx`. If you find that file
  is missing an import or capability it genuinely needs from elsewhere, stop and describe the exact
  problem in the NOTES file (`status: blocked`) rather than editing other files.
- Match this file's existing conventions exactly: the `api` object pattern for all fetch calls
  (fetch → `if (!res.ok) throw new Error(...)` → `return res.json()`), existing `useState`/
  `useCallback` style, the existing `addToast(message, type, agentName?)` calls, existing
  TypeScript interfaces (extend, don't duplicate).
- Never fabricate or hardcode fake repository/entropy data. This is a real input form for real
  users.

## What to build

1. **Track the full project, not just its id.** Change `resolveGCProject()` (or add alongside it)
   so the component knows, for the resolved project: `id`, `title`, and whether `git_remote` is
   set (non-null and non-empty). You have `GET /api/v1/cowork/projects` returning `git_remote` on
   each project object now — use that, no extra request needed.

2. **When there is no project, or the resolved project has no `git_remote`:** in the GC tab's
   render path (replacing today's silent toast-only failure), render:
   ```
   <SettingsCard title="Connect a repository" description="...1-2 sentences explaining GC Agents...">
     ...explanatory list of the six agents (see MAP doc for exact copy)...
     ...a small form: repo URL input (required) + branch input (optional) + "Connect" button...
   </SettingsCard>
   ```
   The explanatory list can be plain `<ul>`/`<li>` markup or `SettingsCardRow`s — your call, keep it
   compact (six short lines, not six paragraphs).

3. **Submit handler for the form:**
   - Validate the repo URL input is non-empty before submitting; if empty, show an inline validation
     message or a toast (`addToast(..., 'error')`) and don't submit.
   - If `gcProjectId` already has a value (a project exists but has no `git_remote` yet): call
     `PUT /api/v1/cowork/projects/${gcProjectId}` with body `{ git_remote, default_branch }`
     (omit `default_branch` from the body or send it as the input value if non-empty — your call,
     matching how `UpdateProjectBody`'s `Option` fields work).
   - If there is no project at all: call `POST /api/v1/cowork/projects` with
     `{ title: "My Codebase", git_remote, default_branch }` (or a similarly sensible default title),
     take the returned `project.id`, and use that going forward.
   - Add corresponding methods to the existing `api` object (e.g. `createProject`, `updateProject`)
     following the exact fetch/error pattern already used by every other method there.
   - On success: update `gcProjectId` (if newly created) and re-resolve/refresh so the normal GC
     queue/policies/history UI renders immediately — call the existing `fetchGCData()` after the
     project state updates (matching how the rest of this file re-fetches after mutations).
   - On failure: surface the error via the existing toast pattern, same as other handlers in this
     file (e.g. `handleUpdateGCPolicy`'s catch block).

4. **When a project already has a `git_remote` configured:** render exactly what renders today
   (queue, policies, cleanup button, history) — no behavior change for the already-working case.

## Verification (yours to run, not a build)

For the one file you changed:
```
node -e "require('esbuild').transformSync(require('fs').readFileSync('surfaces/ai.allternit.com/src/views/settings/AgentOpsPanel.tsx','utf8'),{loader:'tsx'})"
```
This must run without throwing. It only checks syntax, not types — that's expected and sufficient
for this phase.

## Deliverable

Write `docs/GC_SETUP_CARD_NOTES.md` when finished, starting with YAML frontmatter:

```yaml
---
status: done|blocked
files_changed:
  - surfaces/ai.allternit.com/src/views/settings/AgentOpsPanel.tsx
deviations:
  - "what you changed vs the spec, and why"
remaining:
  - "anything left undone or deferred"
---
```

Followed by prose: what the explanatory copy says (paste it), the exact request bodies used for
connect (create vs update path), and confirmation the esbuild check passed. That file existing =
done. Do not start any other work after writing it.
