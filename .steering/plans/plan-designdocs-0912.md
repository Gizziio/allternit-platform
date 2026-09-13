# Plan — designdocs-0912: public docs for the design + artifacts stack

Session: `designdocs-0912` · Branch: `session/designdocs-0912` · DOCS-ONLY (no desktop rebuild).

## Goal

Ship `docs/public/design/` on the docs site: overview index, design-mode page, artifacts page. Every claim grounded in code on origin/main. Honest limits. No invented endpoints/flags/env vars.

## Todos

1. [ ] Read source material:
   - `docs/design/artifacts-api.md` (data model §2, API §3, sharing tiers §6, renderers §2.1)
   - `surfaces/ai.allternit.com/DESIGN.md` (incl. §11 sandbox/CSP)
   - `surfaces/ai.allternit.com/src/lib/design/` (7 files)
   - `src/views/design/` + `src/components/design/` (6 components)
   - `cmd/gizzi-code` /design command, artifact list/show/save commands, routes/critique.ts, routes/design.ts
   - `cmd/allternit-api/src/content_artifact_*.rs` (4 files)
   - Tone refs: `docs/public/tools/native-sessions.md`, `docs/public/aci/index.md`
2. [ ] `docs/public/design/index.md` — overview: A:// Studio design mode across web/desktop/CLI, how pieces fit, links.
3. [ ] `docs/public/design/design-mode.md` — skills+inputs form, model picker, aspect pills; click-to-target edits; Edit in place AST binding; critique panel; gallery; render-and-compare; `/design` CLI; version restore (cap 10).
4. [ ] `docs/public/design/artifacts.md` — `a://artifact/<id>`; save-from-chat provenance; gateway API table; 50-version cap; `/files` routes; sandbox model; gizzi-code artifact CLI; publish (u-<hash>/<id>, unpublish, sandbox-policy gate, wrangler env vars); org relay.
5. [ ] Check `docs/public/resources-overview.md` (or equivalent index) for a section list; add design section matching format.
6. [ ] Conventional commits `docs(public): ...`, push, PR, `gh pr merge --merge`.
7. [ ] Ledger: branch `session/ledger-designdocs-0912` from origin/main post-merge; summary + one LEDGER.md line; PR + merge.
8. [ ] Cleanup: worktree remove, delete session + ledger branches local+remote, final sweep.

## Verification

- Every endpoint/flag/env var/command cross-checked against code (grep the exact string).
- Markdown renders (no broken relative links; check sibling doc link style).
- No code changes → no build/test needed; docs-only PR.
